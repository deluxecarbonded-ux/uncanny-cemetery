export async function initOrt({ backend = 'wasm', wasmPaths, numThreads } = {}) {
  const ortModule = await import('../ort.wasm.bundle.min.mjs');
  const ort = ortModule.default || ortModule.ort || ortModule;
  if (!ort || !ort.env) {
    throw new Error('Failed to initialize local ONNX Runtime Web for Parakeet.js');
  }
  ort.env.wasm.wasmPaths = wasmPaths || 'resource://exotic-assets/asr/';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  if (typeof globalThis !== 'undefined') {
    globalThis.ort = ort;
  }
  return ort;
}
