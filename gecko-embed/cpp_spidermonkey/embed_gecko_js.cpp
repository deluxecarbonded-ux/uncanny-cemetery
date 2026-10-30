// Native C++ application embedding Mozilla's SpiderMonkey (mozjs-128) engine
// (the JavaScript & WebAssembly engine inside Firefox / Gecko).

#include <cstdio>
#include <cstring>
#include <iostream>
#include <string>

#include <jsapi.h>
#include <js/CompilationAndEvaluation.h>
#include <js/Conversions.h>
#include <js/Initialization.h>
#include <js/RootingAPI.h>
#include <js/SourceText.h>
#include <mozilla/Utf8.h>

static JSClass GlobalClass = {
    "GeckoEmbeddedGlobal",
    JSCLASS_GLOBAL_FLAGS,
    &JS::DefaultGlobalClassOps
};

// Native C++ function exposed directly to JavaScript: hostNotify(msg)
static bool HostNotify(JSContext* cx, unsigned argc, JS::Value* vp) {
    JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    if (args.length() < 1) {
        args.rval().setBoolean(false);
        return true;
    }

    JS::RootedString jsStr(cx, JS::ToString(cx, args[0]));
    if (!jsStr) {
        return false;
    }

    JS::UniqueChars utf8 = JS_EncodeStringToUTF8(cx, jsStr);
    if (!utf8) {
        return false;
    }

    std::cout << "[C++ Host Callback <- SpiderMonkey JS] " << utf8.get() << "\n";
    args.rval().setBoolean(true);
    return true;
}

static bool ExecuteEmbeddedScript(JSContext* cx) {
    JS::RealmOptions options;
    JS::RootedObject global(
        cx,
        JS_NewGlobalObject(cx, &GlobalClass, nullptr, JS::FireOnNewGlobalHook, options)
    );
    if (!global) {
        return false;
    }

    JSAutoRealm ar(cx, global);

    // Expose native C++ function `hostNotify` on the JS global object
    if (!JS_DefineFunction(cx, global, "hostNotify", HostNotify, 1, 0)) {
        return false;
    }

    const char* script = R"JS(
        const engine = "Mozilla SpiderMonkey (Gecko JS Engine) mozjs-128";
        const nums = [2, 4, 8, 16, 32];
        const sum = nums.reduce((a, b) => a + b, 0);

        hostNotify(`Initialized ${engine} | Computed sum=${sum}`);

        JSON.stringify({
            engine,
            esFeatures: {
                bigint: (2n ** 64n).toString(),
                groupedSum: sum
            },
            status: "embedded_ok"
        });
    )JS";

    JS::CompileOptions compileOpts(cx);
    compileOpts.setFileAndLine("embedded_app.js", 1);

    JS::SourceText<mozilla::Utf8Unit> srcBuf;
    if (!srcBuf.init(cx, script, std::strlen(script), JS::SourceOwnership::Borrowed)) {
        return false;
    }

    JS::RootedValue rval(cx);
    if (!JS::Evaluate(cx, compileOpts, srcBuf, &rval)) {
        return false;
    }

    JS::RootedString resultStr(cx, JS::ToString(cx, rval));
    if (!resultStr) {
        return false;
    }

    JS::UniqueChars utf8Result = JS_EncodeStringToUTF8(cx, resultStr);
    if (!utf8Result) {
        return false;
    }

    std::cout << "[C++ Host Result] " << utf8Result.get() << "\n";
    return true;
}

int main() {
    if (!JS_Init()) {
        std::cerr << "Failed to initialize SpiderMonkey (JS_Init)\n";
        return 1;
    }

    JSContext* cx = JS_NewContext(JS::DefaultHeapMaxBytes);
    if (!cx) {
        JS_ShutDown();
        return 1;
    }

    int exitCode = 0;
    if (!JS::InitSelfHostedCode(cx) || !ExecuteEmbeddedScript(cx)) {
        std::cerr << "Error executing embedded SpiderMonkey script\n";
        exitCode = 1;
    }

    JS_DestroyContext(cx);
    JS_ShutDown();
    return exitCode;
}
