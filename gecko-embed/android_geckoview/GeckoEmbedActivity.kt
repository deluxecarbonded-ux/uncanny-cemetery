package com.example.geckoembed

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

class GeckoEmbedActivity : AppCompatActivity() {

    companion object {
        // GeckoRuntime is a singleton per process wrapping libxul.so
        private var sRuntime: GeckoRuntime? = null
    }

    private lateinit var geckoView: GeckoView
    private lateinit var geckoSession: GeckoSession

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        geckoView = GeckoView(this)
        setContentView(geckoView)

        if (sRuntime == null) {
            val settings = GeckoRuntimeSettings.Builder()
                .consoleOutput(true)
                .remoteDebuggingEnabled(false)
                .build()
            sRuntime = GeckoRuntime.create(this, settings)
        }

        geckoSession = GeckoSession()
        geckoSession.open(sRuntime!!)
        geckoView.setSession(geckoSession)

        // Load bundled asset or remote app URL inside Gecko
        geckoSession.loadUri("resource://android/assets/index.html")
    }

    override fun onDestroy() {
        geckoSession.close()
        super.onDestroy()
    }
}
