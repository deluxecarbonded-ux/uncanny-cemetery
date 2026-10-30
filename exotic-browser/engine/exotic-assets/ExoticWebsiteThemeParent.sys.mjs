/* ==========================================================================
   Exotic Browser — Website Theme & Live Audio Transcriber Actor (Parent)
   Handles IPC from Exotic internal pages and live video/stream audio chunks.
   ========================================================================== */

export class ExoticWebsiteThemeParent extends JSWindowActorParent {
  receiveMessage(msg) {
    try {
      if (!msg || !msg.name) return;
      const topBC = this.browsingContext && this.browsingContext.top;
      const browser = topBC && topBC.embedderElement;
      const chromeWin =
        (browser && browser.ownerGlobal) ||
        Services.wm.getMostRecentWindow("navigator:browser");
      const ctrl = chromeWin && chromeWin.__exoticWindowController;

      if (msg.name === "Exotic:NewTabSetTheme") {
        const mode = msg.data && msg.data.mode === "light" ? "light" : "dark";
        if (ctrl && typeof ctrl.applyTheme === "function") {
          ctrl.applyTheme(mode);
        }
      } else if (msg.name === "Exotic:NewTabOpenMods") {
        if (chromeWin && typeof chromeWin.__exoticOpenSettingsSection === "function") {
          chromeWin.__exoticOpenSettingsSection("mods");
        }
      } else if (msg.name === "Exotic:NewTabNavigate") {
        const route = String((msg.data && msg.data.route) || "");
        if (route && chromeWin && typeof chromeWin.__exoticNavigateRoute === "function") {
          chromeWin.__exoticNavigateRoute(route);
        }
      } else if (msg.name === "Exotic:OpenLanguageModal") {
        if (
          chromeWin &&
          chromeWin.__exoticTranscriber &&
          typeof chromeWin.__exoticTranscriber.openModal === "function"
        ) {
          chromeWin.__exoticTranscriber.openModal();
        }
      } else if (msg.name === "Exotic:TranscribeAudioChunk") {
        if (
          chromeWin &&
          chromeWin.__exoticTranscriber &&
          typeof chromeWin.__exoticTranscriber.enqueueAudioChunk === "function"
        ) {
          chromeWin.__exoticTranscriber.enqueueAudioChunk(this, msg.data);
        }
      }
    } catch (_) {}
  }
}
