# Same Sky — app launcher (this is what the desktop icon runs).
#
# 1. Finds the already-running Same Sky server, or starts one silently.
# 2. Opens the app in its own clean window (Chrome/Edge app mode), no browser bars.
#
# The address is always http://localhost:4600 — the app's notes, photos and settings
# live in browser storage keyed by that exact origin, so it must never drift.
#
# The browser profile is pinned for the same reason: browser storage is separate per
# profile, so opening the app in a different profile than usual would show an empty
# app with every note and photo apparently gone. PROFILE below is the profile that
# holds the data; change it only if you deliberately move the app to another one.

import ctypes
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(HERE)
SERVER = os.path.join(HERE, "samesky_server.pyw")
PORT = 4600
HOME_URL = f"http://localhost:{PORT}/"
PROFILE = "Default"

DETACHED = 0x00000008 | 0x00000200 | 0x08000000  # DETACHED | NEW_GROUP | NO_WINDOW

BROWSERS = [
    os.path.join(os.environ.get("ProgramFiles", ""), "Google", "Chrome", "Application", "chrome.exe"),
    os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Google", "Chrome", "Application", "chrome.exe"),
    os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "Application", "chrome.exe"),
    os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
    os.path.join(os.environ.get("ProgramFiles", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
]


def alert(msg):
    ctypes.windll.user32.MessageBoxW(None, msg, "Same Sky", 0x10)


def focus_existing_window():
    """If the app is already open, bring that window forward instead of stacking
    another copy on top of it. App windows carry the 💌 in their title; a normal
    browser tab showing the app would end in ' - Google Chrome', so it is skipped."""
    user32 = ctypes.windll.user32
    found = []

    CB = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def visit(hwnd, _):
        if not user32.IsWindowVisible(hwnd):
            return True
        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)
        if cls.value != "Chrome_WidgetWin_1":
            return True
        buf = ctypes.create_unicode_buffer(512)
        user32.GetWindowTextW(hwnd, buf, 512)
        title = buf.value
        if "💌" in title and not title.endswith(" - Google Chrome"):
            found.append(hwnd)
            return False
        return True

    try:
        user32.EnumWindows(CB(visit), None)
    except OSError:
        return False
    if not found:
        return False
    hwnd = found[0]
    user32.ShowWindow(hwnd, 9)          # SW_RESTORE, in case it was minimised
    user32.SetForegroundWindow(hwnd)
    return True


def same_sky_at(host, timeout=0.7):
    """True if OUR app answers there — not just anything holding the port."""
    try:
        url = f"http://{host}:{PORT}/manifest.webmanifest"
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return "Same Sky" in resp.read(400).decode("utf-8", "replace")
    except (urllib.error.URLError, OSError, ValueError):
        return False


def running():
    # localhost is the address we open; 127.0.0.1 is the one the server always binds.
    return same_sky_at("localhost") or same_sky_at("127.0.0.1")


def pythonw():
    exe = sys.executable or ""
    cand = os.path.join(os.path.dirname(exe), "pythonw.exe")
    return cand if os.path.exists(cand) else (exe or "pythonw.exe")


def start_server():
    try:
        subprocess.Popen(
            [pythonw(), SERVER],
            cwd=APP_DIR,
            creationflags=DETACHED,
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError as exc:
        alert(f"Same Sky couldn't start Python.\n\n{exc}")
        return False
    deadline = time.time() + 15
    while time.time() < deadline:
        if running():
            return True
        time.sleep(0.3)
    return False


def open_app(url):
    for browser in BROWSERS:
        if browser and os.path.exists(browser):
            try:
                subprocess.Popen(
                    [
                        browser,
                        f"--profile-directory={PROFILE}",  # must come before --app
                        f"--app={url}",
                        "--window-size=1180,880",
                    ],
                    creationflags=DETACHED,
                    close_fds=True,
                )
                return True
            except OSError:
                continue
    import webbrowser
    return webbrowser.open(url)


def main():
    if focus_existing_window():
        return 0
    if not running() and not start_server():
        # start_server() shows its own message for a port conflict; this covers the rest.
        if not running():
            alert(
                "Same Sky couldn't start its local server.\n\n"
                "If this keeps happening, restart the laptop and try again."
            )
            return 1
    open_app(HOME_URL)
    return 0


if __name__ == "__main__":
    sys.exit(main())
