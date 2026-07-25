# Same Sky — background web server (no console window).
#
# Serves the app folder on the loopback address only, so nothing is exposed to the
# network and Windows Firewall never prompts. Started automatically by
# samesky_launch.pyw; you normally never run this by hand.
#
# The port is PINNED to 4600 on purpose. The app keeps your notes, photos and
# settings in browser storage, which the browser keys by origin — so
# http://localhost:4600 and http://localhost:4601 would look like two different,
# empty apps. Failing loudly on a port conflict is much kinder than silently
# opening an empty copy that looks like everything was lost.

import ctypes
import http.server
import os
import socket
import socketserver
import sys
import threading
import urllib.error
import urllib.request

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 4600


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP_DIR, **kw)

    def log_message(self, *args):
        pass  # stay silent; there is no console to log to

    def end_headers(self):
        # never cache, so edits to the app show up on refresh
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class V4Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = False  # bind must fail if something else holds the port


class V6Server(V4Server):
    address_family = socket.AF_INET6


def alert(msg):
    ctypes.windll.user32.MessageBoxW(None, msg, "Same Sky", 0x10)


def same_sky_already_there():
    """Is the port held by another copy of us? (Two quick double-clicks race here.)"""
    try:
        url = f"http://127.0.0.1:{PORT}/manifest.webmanifest"
        with urllib.request.urlopen(url, timeout=1.5) as resp:
            return "Same Sky" in resp.read(400).decode("utf-8", "replace")
    except (urllib.error.URLError, OSError, ValueError):
        return False


def main():
    os.chdir(APP_DIR)
    try:
        v4 = V4Server(("127.0.0.1", PORT), Handler)
    except OSError:
        if same_sky_already_there():
            return 0  # we simply lost a race with another launch; nothing is wrong
        alert(
            f"Same Sky needs port {PORT}, but another program is already using it.\n\n"
            "Close that program (or restart the laptop) and open Same Sky again.\n\n"
            "Same Sky always uses this one port so your notes and photos stay put."
        )
        return 1

    # Also answer on the IPv6 loopback, so "localhost" works no matter which
    # address Windows resolves it to first. Best-effort: not fatal if missing.
    try:
        v6 = V6Server(("::1", PORT), Handler)
        threading.Thread(target=v6.serve_forever, daemon=True).start()
    except OSError:
        pass

    try:
        v4.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        v4.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
