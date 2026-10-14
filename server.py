import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

class SinglePageAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        serve_dir = str(DIST) if DIST.exists() else str(ROOT)
        super().__init__(*args, directory=serve_dir, **kwargs)

    def do_GET(self):
        # Strip query and hash
        raw_path = self.path.split("?", 1)[0].split("#", 1)[0]
        serve_dir = DIST if DIST.exists() else ROOT
        target = (serve_dir / raw_path.lstrip("/")).resolve()

        # If requested file exists, serve it
        if target.is_file() and str(target).startswith(str(serve_dir)):
            return super().do_GET()

        # Otherwise serve index.html for React SPA routing
        self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self):
        self.path = "/index.html"
        return super().do_HEAD()

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"status":"success","message":"BitX Core Operations Portal Online"}')

def run():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), SinglePageAppHandler)
    print(f"BitX Core Web Service rodando na porta {port}...")
    server.serve_forever()

if __name__ == "__main__":
    run()
