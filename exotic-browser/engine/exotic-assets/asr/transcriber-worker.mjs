/* ==========================================================================
   Exotic Browser — Open-Source Neural Audio Transcriber Worker
   - NVIDIA Parakeet TDT 0.6B v3 (parakeet.js + ONNX Runtime Web)
   - Whisper Multilingual 99-Language Acoustic Auto-Detect (@huggingface/transformers)
   - Persistent Local Disk Model Cache + Free Unlimited Target-Language Translation
   ========================================================================== */

let cacheRpcSeq = 0;
const pendingCacheRpc = new Map();

function callCacheRpc(type, payload, transfer = []) {
  const reqId = ++cacheRpcSeq;
  return new Promise((resolve) => {
    pendingCacheRpc.set(reqId, resolve);
    self.postMessage({ type, reqId, ...payload }, transfer);
  });
}

// Custom Cache API adapter backed by Exotic Profile disk storage (IOUtils)
const exoticDiskCache = {
  async match(request) {
    try {
      const key = typeof request === "string" ? request : request.url;
      const res = await callCacheRpc("cache-get", { key });
      if (res && res.hit && res.bytes) {
        const headers = new Headers({
          "Content-Type": key.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
          "Content-Length": String(res.bytes.byteLength),
        });
        return new Response(res.bytes, { status: 200, headers });
      }
    } catch (_) {}
    return undefined;
  },
  async put(request, response) {
    try {
      const key = typeof request === "string" ? request : request.url;
      const clone = response.clone();
      const ab = await clone.arrayBuffer();
      if (ab && ab.byteLength > 0 && ab.byteLength <= 80 * 1024 * 1024) {
        await callCacheRpc("cache-put", { key, bytes: ab }, [ab]);
      }
    } catch (_) {}
  },
};

async function urlExists(url) {
  try {
    const r = await fetch(url);
    return r && (r.ok || r.status === 0);
  } catch (_) {
    return false;
  }
}

let tfModPromise = null;
let whisperPipePromise = null;
let parakeetModelPromise = null;
const localMtPipes = new Map();

async function getTransformers() {
  if (!tfModPromise) {
    tfModPromise = (async () => {
      const mod = await import("./transformers.min.js");
      const { env } = mod;
      const hasLocalWasm = await urlExists(
        "resource://exotic-assets/asr/ort-wasm-simd-threaded.jsep.wasm"
      );
      env.allowLocalModels = Boolean(self.__exoticLocalModelBase);
      if (self.__exoticLocalModelBase) {
        env.localModelPath = self.__exoticLocalModelBase;
      }
      env.allowRemoteModels = true;
      env.useBrowserCache = false;
      env.useCustomCache = true;
      env.customCache = exoticDiskCache;
      env.backends.onnx.wasm.wasmPaths = hasLocalWasm
        ? "resource://exotic-assets/asr/"
        : "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/";
      env.backends.onnx.wasm.numThreads = 1;
      env.backends.onnx.wasm.proxy = false;
      return mod;
    })();
  }
  return tfModPromise;
}

const fileProgressMap = new Map();
function emitDownloadProgress(engineLabel, info) {
  if (!info) return;
  if (info.status === "progress" && info.file && info.total > 0) {
    fileProgressMap.set(info.file, {
      loaded: info.loaded || 0,
      total: info.total || 1,
    });
    let sumLoaded = 0;
    let sumTotal = 0;
    for (const v of fileProgressMap.values()) {
      sumLoaded += v.loaded;
      sumTotal += v.total;
    }
    const pct = Math.min(99, Math.max(1, Math.round((sumLoaded / sumTotal) * 100)));
    self.postMessage({
      type: "model-progress",
      engineLabel,
      percent: pct,
      file: info.file,
    });
  } else if (info.status === "ready") {
    fileProgressMap.clear();
    self.postMessage({
      type: "model-progress",
      engineLabel,
      percent: 100,
      ready: true,
    });
  }
}

async function getWhisperPipeline() {
  if (!whisperPipePromise) {
    whisperPipePromise = (async () => {
      const { pipeline } = await getTransformers();
      const modelId = "Xenova/whisper-tiny";
      const pipe = await pipeline("automatic-speech-recognition", modelId, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => emitDownloadProgress("Whisper Multilingual ONNX", p),
      });
      return pipe;
    })().catch((err) => {
      whisperPipePromise = null;
      throw err;
    });
  }
  return whisperPipePromise;
}

async function fetchCachedBlobUrl(remoteUrl, engineLabel, labelFile) {
  const cached = await exoticDiskCache.match(remoteUrl);
  if (cached) {
    const ab = await cached.arrayBuffer();
    return URL.createObjectURL(new Blob([ab]));
  }
  const resp = await fetch(remoteUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${labelFile} (${resp.status})`);
  }
  const total = Number(resp.headers.get("content-length") || 0);
  if (!resp.body || !total) {
    const ab = await resp.arrayBuffer();
    await exoticDiskCache.put(remoteUrl, new Response(ab.slice(0)));
    return URL.createObjectURL(new Blob([ab]));
  }
  const reader = resp.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastEmit = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    const now = performance.now();
    if (now - lastEmit > 180) {
      lastEmit = now;
      emitDownloadProgress(engineLabel, {
        status: "progress",
        file: labelFile,
        loaded,
        total,
      });
    }
  }
  const full = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    full.set(c, off);
    off += c.byteLength;
  }
  await exoticDiskCache.put(remoteUrl, new Response(full.buffer.slice(0)));
  return URL.createObjectURL(new Blob([full]));
}

const PARAKEET_V3_LANGS = new Set([
  "en", "fr", "de", "es", "it", "pt", "nl", "pl", "ru", "uk",
  "cs", "sk", "sl", "hr", "bg", "ro", "hu", "el", "da", "sv",
  "no", "fi", "et", "lv", "lt",
]);

async function getParakeetModel() {
  if (!parakeetModelPromise) {
    parakeetModelPromise = (async () => {
      const hasLocalOrtWasm = await urlExists(
        "resource://exotic-assets/asr/ort-wasm-simd-threaded.wasm"
      );
      const wasmPaths = hasLocalOrtWasm
        ? "resource://exotic-assets/asr/"
        : "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/";
      const { fromUrls } = await import("./parakeet/index.js");
      const base =
        "https://huggingface.co/efederici/parakeet-tdt-0.6b-v3-onnx-int4/resolve/main";
      const label = "NVIDIA Parakeet TDT 0.6B v3";
      const [vocabUrl, decoderUrl, encoderUrl] = await Promise.all([
        fetchCachedBlobUrl(`${base}/vocab.txt`, label, "vocab.txt"),
        fetchCachedBlobUrl(
          `${base}/decoder_joint-model.int8.onnx`,
          label,
          "decoder_joint-model.int8.onnx"
        ),
        fetchCachedBlobUrl(
          `${base}/encoder-model.int4.onnx`,
          label,
          "encoder-model.int4.onnx"
        ),
      ]);
      emitDownloadProgress(label, { status: "ready" });
      return await fromUrls({
        encoderUrl,
        decoderUrl,
        tokenizerUrl: vocabUrl,
        preprocessorBackend: "js",
        backend: "wasm",
        wasmPaths,
      });
    })().catch((err) => {
      parakeetModelPromise = null;
      throw err;
    });
  }
  return parakeetModelPromise;
}

// Per-stream temporal language stabilizer for real acoustic Auto-Detect
const streamLangMemory = new Map();

function stabilizeDetectedLanguage(streamKey, bestLang, bestProb) {
  if (!streamKey) return bestLang;
  const prev = streamLangMemory.get(streamKey);
  if (!prev) {
    streamLangMemory.set(streamKey, {
      lang: bestLang,
      candidate: bestLang,
      streak: 1,
      updatedAt: Date.now(),
    });
    return bestLang;
  }
  prev.updatedAt = Date.now();
  if (bestLang === prev.lang) {
    prev.candidate = bestLang;
    prev.streak = 0;
    return prev.lang;
  }
  // High-confidence switch (>= 58%) or 2 consecutive chunks agreeing on the new spoken language
  if (bestProb >= 0.58) {
    prev.lang = bestLang;
    prev.candidate = bestLang;
    prev.streak = 0;
    return bestLang;
  }
  if (prev.candidate === bestLang) {
    prev.streak += 1;
    if (prev.streak >= 2 && bestProb >= 0.32) {
      prev.lang = bestLang;
      prev.streak = 0;
      return bestLang;
    }
  } else {
    prev.candidate = bestLang;
    prev.streak = 1;
  }
  return prev.lang;
}

const HALLUCINATION_PATTERNS = [
  /^\[(?:music|applause|laughter|silence|blank_audio|inaudible)\]$/i,
  /^\((?:music|applause|laughter|silence|upbeat music|speaking .*?)\)$/i,
  /^♪+.*♪*$/,
  /^(?:thank you for watching|thanks for watching|sous-titres réalisés|amara\.org|subtitles by)/i,
];

function cleanTranscriptText(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/<\|[^>]+?\|>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  for (const re of HALLUCINATION_PATTERNS) {
    if (re.test(s)) return "";
  }
  // Filter pathological 4+ phrase repetition loops on background noise
  const words = s.split(" ");
  if (words.length >= 8) {
    const uniq = new Set(words.map((w) => w.toLowerCase()));
    if (uniq.size <= 2) return "";
  }
  return s;
}

function baseIsoLang(code) {
  const c = String(code || "en").toLowerCase();
  if (c.startsWith("zh")) return "zh";
  return c.split("-")[0];
}

const translationCache = new Map();

function rememberTranslation(key, val) {
  if (translationCache.size > 500) {
    const oldest = translationCache.keys().next().value;
    translationCache.delete(oldest);
  }
  translationCache.set(key, val);
}

async function fetchWithTimeout(url, ms = 2600) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

async function getLocalMarianTranslator(tgtIso) {
  const cleanTgt = baseIsoLang(tgtIso);
  if (!cleanTgt || cleanTgt === "en") return null;
  if (localMtPipes.has(cleanTgt)) {
    return localMtPipes.get(cleanTgt);
  }
  const p = (async () => {
    const { pipeline } = await getTransformers();
    return await pipeline("translation", `Xenova/opus-mt-en-${cleanTgt}`, {
      dtype: "q8",
      device: "wasm",
    });
  })().catch(() => {
    localMtPipes.delete(cleanTgt);
    return null;
  });
  localMtPipes.set(cleanTgt, p);
  return p;
}

async function translateCaption(text, sourceLang, targetLang) {
  if (!text) return "";
  if (!targetLang || targetLang === "auto") return text;
  if (
    baseIsoLang(sourceLang) === baseIsoLang(targetLang) &&
    targetLang !== "zh-TW" &&
    targetLang !== "zh-CN"
  ) {
    return text;
  }
  const cacheKey = `${sourceLang}|${targetLang}|${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const normIn = text.trim().toLowerCase();
  const isDistinct = (candidate) =>
    Boolean(candidate && candidate.trim() && candidate.trim().toLowerCase() !== normIn);

  const srcCode = baseIsoLang(sourceLang) || "auto";
  const mozhiTgt =
    targetLang === "zh-CN" ? "zh-CN" : targetLang === "zh-TW" ? "zh-TW" : baseIsoLang(targetLang);

  // 1. Open-Source AGPLv3 Mozhi multi-engine translation gateway
  for (const eng of ["google", "duckduckgo"]) {
    try {
      const u =
        `https://mozhi.aryak.me/api/translate?engine=${eng}&from=` +
        encodeURIComponent(srcCode) +
        `&to=` +
        encodeURIComponent(mozhiTgt) +
        `&text=` +
        encodeURIComponent(text);
      const r = await fetchWithTimeout(u, 2400);
      if (r.ok) {
        const j = await r.json();
        const out = j && (j["translated-text"] || j.translated_text || "");
        if (isDistinct(out)) {
          const clean = out.trim();
          rememberTranslation(cacheKey, clean);
          return clean;
        }
      }
    } catch (_) {}
  }

  // 2. MyMemory Open Translation Memory API
  try {
    const pairSrc = srcCode === "auto" ? "en" : srcCode;
    const u =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) +
      "&langpair=" +
      encodeURIComponent(`${pairSrc}|${targetLang}`);
    const r = await fetchWithTimeout(u, 2500);
    if (r.ok) {
      const j = await r.json();
      const out = j && j.responseData && j.responseData.translatedText;
      if (isDistinct(out) && !/^MYMEMORY WARNING/i.test(out)) {
        const clean = out.trim();
        rememberTranslation(cacheKey, clean);
        return clean;
      }
    }
  } catch (_) {}

  // 3. Unauthenticated gtx endpoint
  try {
    const u =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
      encodeURIComponent(sourceLang || "auto") +
      "&tl=" +
      encodeURIComponent(targetLang) +
      "&dt=t&q=" +
      encodeURIComponent(text);
    const r = await fetchWithTimeout(u, 2200);
    if (r.ok) {
      const tr = await r.json();
      if (Array.isArray(tr) && Array.isArray(tr[0])) {
        const out = tr[0].map((seg) => (seg && seg[0]) || "").join("").trim();
        if (isDistinct(out)) {
          rememberTranslation(cacheKey, out);
          return out;
        }
      }
    }
  } catch (_) {}

  return null;
}

async function transcribeChunk({ pcm, targetLang, engine, streamKey }) {
  const t0 = performance.now();
  const { Tensor } = await getTransformers();
  const asrPipe = await getWhisperPipeline();

  // Step 1: Real 99-language acoustic Auto-Detection from Whisper encoder + 1-step SOT logits
  const processed = await asrPipe.processor(pcm);
  const genCfg = asrPipe.model.generation_config;
  const langMap = genCfg.lang_to_id || {};
  const sotId = BigInt(genCfg.decoder_start_token_id || 50258);
  const decIds = new Tensor("int64", BigInt64Array.from([sotId]), [1, 1]);

  const fwd = await asrPipe.model.forward({
    input_features: processed.input_features,
    decoder_input_ids: decIds,
  });

  const logitsData = fwd.logits.data;
  const vocabSize = fwd.logits.dims[fwd.logits.dims.length - 1];
  const baseOffset = logitsData.length - vocabSize;

  let bestLang = "en";
  let maxLogit = -Infinity;
  const entries = [];
  for (const [tok, tid] of Object.entries(langMap)) {
    const m = tok.match(/^<\|([a-z]{2,3})\|>$/i);
    if (!m) continue;
    const sc = logitsData[baseOffset + Number(tid)];
    entries.push([m[1].toLowerCase(), sc]);
    if (sc > maxLogit) {
      maxLogit = sc;
      bestLang = m[1].toLowerCase();
    }
  }
  let expSum = 0;
  let bestExp = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = Math.exp(entries[i][1] - maxLogit);
    expSum += e;
    if (entries[i][0] === bestLang) bestExp = e;
  }
  const bestProb = expSum > 0 ? bestExp / expSum : 0;
  const detectedLang = stabilizeDetectedLanguage(streamKey, bestLang, bestProb);

  // Step 2: Open-Source Neural Speech-to-Text (Parakeet TDT 0.6B v3 or Whisper Multilingual reusing encoder_outputs)
  let sourceText = "";
  let usedEngine = "Whisper Multilingual ONNX";

  if (engine === "parakeet-tdt-v3" && PARAKEET_V3_LANGS.has(detectedLang)) {
    try {
      const pk = await getParakeetModel();
      const pkRes = await pk.transcribe(pcm, 16000, { returnTimestamps: false });
      sourceText = cleanTranscriptText(
        (pkRes && (pkRes.utterance_text || pkRes.text)) || ""
      );
      usedEngine = "NVIDIA Parakeet TDT 0.6B v3";
    } catch (_) {
      sourceText = "";
    }
  }

  if (!sourceText) {
    // When Transcribe To is English and speech is non-English, Whisper's native neural
    // speech->English head translates directly from encoder_outputs in one local pass!
    if (targetLang === "en" && detectedLang !== "en") {
      const enGen = await asrPipe.model.generate({
        inputs: processed.input_features,
        encoder_outputs: fwd.encoder_outputs,
        language: detectedLang,
        task: "translate",
      });
      const directEn = cleanTranscriptText(
        asrPipe.tokenizer.decode(enGen[0].tolist(), { skip_special_tokens: true })
      );
      try {
        fwd.logits?.dispose?.();
        fwd.encoder_outputs?.dispose?.();
        processed.input_features?.dispose?.();
        decIds?.dispose?.();
      } catch (_) {}
      if (!directEn) {
        return {
          empty: true,
          detectedLang,
          confidence: Math.round(bestProb * 100),
          engineLabel: usedEngine,
          ms: Math.round(performance.now() - t0),
        };
      }
      return {
        empty: false,
        detectedLang,
        confidence: Math.round(bestProb * 100),
        sourceText: directEn,
        captionText: directEn,
        engineLabel: usedEngine,
        ms: Math.round(performance.now() - t0),
      };
    }

    const gen = await asrPipe.model.generate({
      inputs: processed.input_features,
      encoder_outputs: fwd.encoder_outputs,
      language: detectedLang,
      task: "transcribe",
    });
    sourceText = cleanTranscriptText(
      asrPipe.tokenizer.decode(gen[0].tolist(), { skip_special_tokens: true })
    );
  }

  if (!sourceText) {
    try {
      fwd.logits?.dispose?.();
      fwd.encoder_outputs?.dispose?.();
      processed.input_features?.dispose?.();
      decIds?.dispose?.();
    } catch (_) {}
    return {
      empty: true,
      detectedLang,
      confidence: Math.round(bestProb * 100),
      engineLabel: usedEngine,
      ms: Math.round(performance.now() - t0),
    };
  }

  // Step 3: Translate into user-selected "Transcribe To" language when needed
  let captionText = sourceText;
  if (targetLang && targetLang !== "auto") {
    const needTranslate =
      baseIsoLang(detectedLang) !== baseIsoLang(targetLang) ||
      targetLang === "zh-TW" ||
      targetLang === "zh-CN";
    if (needTranslate) {
      const translated = await translateCaption(sourceText, detectedLang, targetLang);
      if (translated) {
        captionText = translated;
      } else if (targetLang === "en" && detectedLang !== "en") {
        const enGen = await asrPipe.model.generate({
          inputs: processed.input_features,
          encoder_outputs: fwd.encoder_outputs,
          language: detectedLang,
          task: "translate",
        });
        captionText =
          cleanTranscriptText(
            asrPipe.tokenizer.decode(enGen[0].tolist(), { skip_special_tokens: true })
          ) || sourceText;
      } else {
        // Local offline ONNX MarianMT fallback (English pivot -> Target Language)
        let pivotEn = sourceText;
        if (detectedLang !== "en") {
          const enGen = await asrPipe.model.generate({
            inputs: processed.input_features,
            encoder_outputs: fwd.encoder_outputs,
            language: detectedLang,
            task: "translate",
          });
          pivotEn =
            cleanTranscriptText(
              asrPipe.tokenizer.decode(enGen[0].tolist(), { skip_special_tokens: true })
            ) || sourceText;
        }
        const mtPipe = await getLocalMarianTranslator(targetLang);
        if (mtPipe && pivotEn) {
          const mtOut = await mtPipe(pivotEn);
          const mtText =
            Array.isArray(mtOut) && mtOut[0] && mtOut[0].translation_text
              ? mtOut[0].translation_text.trim()
              : "";
          if (mtText) captionText = mtText;
        }
      }
    }
  }

  try {
    fwd.logits?.dispose?.();
    fwd.encoder_outputs?.dispose?.();
    processed.input_features?.dispose?.();
    decIds?.dispose?.();
  } catch (_) {}

  return {
    empty: false,
    detectedLang,
    confidence: Math.round(bestProb * 100),
    sourceText,
    captionText,
    engineLabel: usedEngine,
    ms: Math.round(performance.now() - t0),
  };
}

self.onmessage = async (ev) => {
  const data = ev.data || {};
  if (data.type === "cache-reply") {
    const resolver = pendingCacheRpc.get(data.reqId);
    if (resolver) {
      pendingCacheRpc.delete(data.reqId);
      resolver(data);
    }
    return;
  }

  if (data.type === "set-local-model-base") {
    self.__exoticLocalModelBase = data.url || "";
    return;
  }

  if (data.type === "warmup") {
    try {
      if (data.engine === "parakeet-tdt-v3") {
        await getWhisperPipeline();
        await getParakeetModel();
      } else {
        await getWhisperPipeline();
      }
      self.postMessage({ type: "warmup-done", ok: true });
    } catch (err) {
      self.postMessage({ type: "warmup-done", ok: false, error: String(err) });
    }
    return;
  }

  if (data.type === "transcribe") {
    try {
      const res = await transcribeChunk(data);
      self.postMessage({
        type: "transcribe-result",
        jobId: data.jobId,
        ok: true,
        ...res,
      });
    } catch (err) {
      self.postMessage({
        type: "transcribe-result",
        jobId: data.jobId,
        ok: false,
        error: String(err),
      });
    }
  }
};
