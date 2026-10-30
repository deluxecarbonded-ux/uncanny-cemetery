// ============================================================================
// Exotic Web Browser for Windows 11 — Native Win64 Host Launcher
// Monochrome Light (#FFFFFF) & Dark (#000000) Edition
// ============================================================================

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <objbase.h>

#include <cstdio>
#include <string>
#include <vector>

static bool FileExistsW(const std::wstring& path) {
    DWORD attr = GetFileAttributesW(path.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES) && !(attr & FILE_ATTRIBUTE_DIRECTORY);
}

static bool DirExistsW(const std::wstring& path) {
    DWORD attr = GetFileAttributesW(path.c_str());
    return (attr != INVALID_FILE_ATTRIBUTES) && (attr & FILE_ATTRIBUTE_DIRECTORY);
}

static void EnsureDirRecursiveW(const std::wstring& dirPath) {
    if (dirPath.empty() || DirExistsW(dirPath)) return;
    SHCreateDirectoryExW(nullptr, dirPath.c_str(), nullptr);
}

static std::wstring GetExeDirectory() {
    wchar_t buf[MAX_PATH * 4] = {0};
    DWORD len = GetModuleFileNameW(nullptr, buf, MAX_PATH * 4 - 1);
    std::wstring full(buf, len);
    size_t pos = full.find_last_of(L"\\/");
    return (pos == std::wstring::npos) ? L"." : full.substr(0, pos);
}

static std::wstring GetLocalAppDataDir() {
    PWSTR rawPath = nullptr;
    std::wstring result;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &rawPath)) && rawPath) {
        result = rawPath;
        CoTaskMemFree(rawPath);
    } else {
        wchar_t envBuf[MAX_PATH * 2] = {0};
        if (GetEnvironmentVariableW(L"LOCALAPPDATA", envBuf, MAX_PATH * 2)) {
            result = envBuf;
        }
    }
    return result;
}

static bool IsWindows11LightMode() {
    HKEY hKey = nullptr;
    DWORD value = 0; // Default to Dark (#000000) if key absent
    DWORD size = sizeof(DWORD);
    if (RegOpenKeyExW(
            HKEY_CURRENT_USER,
            L"Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
            0,
            KEY_READ,
            &hKey) == ERROR_SUCCESS) {
        RegQueryValueExW(hKey, L"AppsUseLightTheme", nullptr, nullptr, reinterpret_cast<LPBYTE>(&value), &size);
        RegCloseKey(hKey);
    }
    return value != 0;
}

static std::string WideToUtf8(const std::wstring& w) {
    if (w.empty()) return {};
    int needed = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    std::string out(needed, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), out.data(), needed, nullptr, nullptr);
    return out;
}

static std::string PathToFileUriUtf8(const std::wstring& winPath) {
    std::string utf8 = WideToUtf8(winPath);
    std::string uri = "file:///";
    for (unsigned char c : utf8) {
        if (c == '\\') uri.push_back('/');
        else if (c == ' ') uri += "%20";
        else if (c == '#') uri += "%23";
        else uri.push_back((char)c);
    }
    return uri;
}

static void RemoveDirectoryRecursiveW(const std::wstring& dirPath) {
    if (dirPath.empty() || !DirExistsW(dirPath)) return;
    WIN32_FIND_DATAW fd = {};
    std::wstring pattern = dirPath + L"\\*";
    HANDLE hFind = FindFirstFileW(pattern.c_str(), &fd);
    if (hFind != INVALID_HANDLE_VALUE) {
        do {
            std::wstring name = fd.cFileName;
            if (name == L"." || name == L"..") continue;
            std::wstring child = dirPath + L"\\" + name;
            if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                RemoveDirectoryRecursiveW(child);
            } else {
                SetFileAttributesW(child.c_str(), FILE_ATTRIBUTE_NORMAL);
                DeleteFileW(child.c_str());
            }
        } while (FindNextFileW(hFind, &fd));
        FindClose(hFind);
    }
    RemoveDirectoryW(dirPath.c_str());
}

static bool ProvisionExoticProfile(const std::wstring& profileDir, const std::wstring& assetsDir) {
    const bool isFirstRun = !FileExistsW(profileDir + L"\\prefs.js");
    const std::wstring buildStampPath = profileDir + L"\\exotic-build-v24.stamp";
    bool needsCachePurge = false;
    if (!FileExistsW(buildStampPath)) {
        RemoveDirectoryRecursiveW(profileDir + L"\\startupCache");
        FILE* sf = _wfopen(buildStampPath.c_str(), L"wb");
        if (sf) {
            const char* tag = "exotic-159-v24\n";
            fwrite(tag, 1, 15, sf);
            fclose(sf);
        }
        needsCachePurge = true;
    }

    std::wstring chromeDir = profileDir + L"\\chrome";
    EnsureDirRecursiveW(chromeDir);

    const wchar_t* cssFiles[] = { L"userChrome.css", L"userContent.css" };
    for (const wchar_t* name : cssFiles) {
        std::wstring src = assetsDir + L"\\" + name;
        std::wstring dst = chromeDir + L"\\" + name;
        if (FileExistsW(src)) {
            CopyFileW(src.c_str(), dst.c_str(), FALSE);
        }
    }

    std::wstring newtabPath = assetsDir + L"\\newtab.html";
    std::string newtabUri = FileExistsW(newtabPath)
        ? PathToFileUriUtf8(newtabPath)
        : "about:blank";

    // Write baseline user.js (without overriding user-selected theme after first run)
    std::wstring userJsPath = profileDir + L"\\user.js";
    FILE* fp = _wfopen(userJsPath.c_str(), L"wb");
    if (fp) {
        std::string content =
            "// Exotic Browser — Windows 11 Profile Bootstrap\n"
            "user_pref(\"toolkit.legacyUserProfileCustomizations.stylesheets\", true);\n"
            "user_pref(\"browser.urlbar.scotchBonnet.enableOverride\", false);\n"
            "user_pref(\"browser.tabs.inTitlebar\", 1);\n"
            "user_pref(\"browser.toolbars.bookmarks.visibility\", \"never\");\n"
            "user_pref(\"browser.shell.customIcon.enabled\", true);\n"
            "user_pref(\"browser.shell.customIcon.id\", \"minimal\");\n"
            "user_pref(\"sidebar.revamp\", false);\n"
            "user_pref(\"browser.tabs.splitView.enabled\", true);\n"
            "user_pref(\"browser.preonboarding.enabled\", false);\n"
            "user_pref(\"browser.aboutwelcome.enabled\", false);\n"
            "user_pref(\"browser.display.document_color_use\", 1);\n"
            "user_pref(\"termsofuse.bypassNotification\", true);\n"
            "user_pref(\"termsofuse.acceptedVersion\", 999);\n"
            "user_pref(\"termsofuse.acceptedDate\", \"1793133800000\");\n"
            "user_pref(\"termsofuse.firstAcceptedDate\", \"1793133800000\");\n"
            "user_pref(\"browser.startup.firstrunSkipsHomepage\", false);\n"
            "user_pref(\"browser.shell.checkDefaultBrowser\", false);\n"
            "user_pref(\"datareporting.policy.dataSubmissionEnabled\", false);\n"
            "user_pref(\"datareporting.healthreport.uploadEnabled\", false);\n"
            "user_pref(\"toolkit.telemetry.enabled\", false);\n"
            "user_pref(\"extensions.pocket.enabled\", false);\n"
            "user_pref(\"extensions.InstallTrigger.enabled\", false);\n"
            "user_pref(\"general.useragent.override\", \"Exotic/5.0 (Windows NT 10.0; Win64; x64) ExoticEngine/159.0 Exotic/159.0\");\n"
            "user_pref(\"privacy.trackingprotection.enabled\", false);\n"
            "user_pref(\"privacy.fingerprintingProtection\", true);\n"
            "user_pref(\"privacy.fingerprintingProtection.overrides\", \"+CanvasRandomization,+WebGLRandomization,+WebGLRenderCapability,+JSMathFdlibm,+FontVisibilityBaseSystem,+FontVisibilityRestrictGenerics,+NavigatorHWConcurrencyTiered,+ScreenAvailToResolution,+WindowScreenXY,+WindowInnerScreenXY,+DeviceSensors,+PointerEvents,+CSSPointerCapabilities\");\n"
            "user_pref(\"privacy.globalprivacycontrol.enabled\", true);\n"
            "user_pref(\"privacy.donottrackheader.enabled\", true);\n"
            "user_pref(\"webgl.enable-debug-renderer-info\", false);\n"
            "user_pref(\"media.captureStream.enabled\", true);\n"
            "user_pref(\"network.connectivity-service.enabled\", true);\n"
            "user_pref(\"network.http.fast-fallback-to-IPv4\", true);\n"
            "user_pref(\"browser.startup.page\", 1);\n"
            "user_pref(\"browser.startup.homepage\", \"" + newtabUri + "\");\n";

        if (isFirstRun) {
            bool osLight = IsWindows11LightMode();
            if (osLight) {
                content += "user_pref(\"exotic.theme.mode\", \"light\");\n";
            } else {
                content += "user_pref(\"exotic.theme.mode\", \"dark\");\n";
            }
        }

        fwrite(content.data(), 1, content.size(), fp);
        fclose(fp);
    }
    return needsCachePurge;
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR lpCmdLine, int) {
    SetCurrentProcessExplicitAppUserModelID(L"Exotic.WebBrowser.Win11");

    const std::wstring exeDir = GetExeDirectory();
    const std::wstring localAppData = GetLocalAppDataDir();
    const std::wstring exoticAppData = localAppData.empty()
        ? (exeDir + L"\\data")
        : (localAppData + L"\\ExoticBrowser");

    const std::wstring profileDir = FileExistsW(exeDir + L"\\portable.mode")
        ? (exeDir + L"\\data\\profile")
        : (exoticAppData + L"\\Profile");
    EnsureDirRecursiveW(profileDir);

    // Locate bundled x64 engine binary inside the runtime directory
    // (Note: internal runtime binary name is preserved for Windows sandbox compatibility)
    std::wstring engineExe;
    std::wstring assetsDir;

    const std::wstring bundledEngine = exeDir + L"\\runtime\\firefox.exe";
    const std::wstring appDataEngine = exoticAppData + L"\\runtime\\firefox.exe";

    if (FileExistsW(bundledEngine)) {
        engineExe = bundledEngine;
        assetsDir = exeDir + L"\\runtime\\exotic-assets";
    } else if (FileExistsW(appDataEngine)) {
        engineExe = appDataEngine;
        assetsDir = exoticAppData + L"\\runtime\\exotic-assets";
    }

    if (!DirExistsW(assetsDir) && DirExistsW(exeDir + L"\\engine\\exotic-assets")) {
        assetsDir = exeDir + L"\\engine\\exotic-assets";
    }

    if (engineExe.empty()) {
        MessageBoxW(
            nullptr,
            L"Exotic Engine runtime directory (.\\runtime) was not found.\n"
            L"Please run Exotic-Win11-Setup-x64.exe to install the complete offline browser.",
            L"Exotic Browser",
            MB_OK | MB_ICONERROR
        );
        return 1;
    }

    const bool purgeCaches = ProvisionExoticProfile(profileDir, assetsDir);

    std::wstring cmd = L"\"" + engineExe + L"\" -profile \"" + profileDir + L"\"";
    if (purgeCaches) {
        cmd += L" -purgecaches";
    }
    if (lpCmdLine && lpCmdLine[0] != L'\0') {
        cmd += L" ";
        cmd += lpCmdLine;
    } else {
        std::wstring newtabHtml = assetsDir + L"\\newtab.html";
        if (FileExistsW(newtabHtml)) {
            std::string uri = PathToFileUriUtf8(newtabHtml);
            std::wstring wUri(uri.begin(), uri.end());
            cmd += L" \"" + wUri + L"\"";
        }
    }

    STARTUPINFOW si = { sizeof(si) };
    PROCESS_INFORMATION pi = {};
    std::vector<wchar_t> mutableCmd(cmd.begin(), cmd.end());
    mutableCmd.push_back(L'\0');

    if (!CreateProcessW(
            engineExe.c_str(),
            mutableCmd.data(),
            nullptr,
            nullptr,
            FALSE,
            0,
            nullptr,
            exeDir.c_str(),
            &si,
            &pi)) {
        MessageBoxW(
            nullptr,
            L"Unable to start Exotic Engine runtime.",
            L"Exotic Browser",
            MB_OK | MB_ICONERROR
        );
        return 1;
    }

    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return 0;
}
