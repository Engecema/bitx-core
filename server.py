import os
import sys
import mimetypes
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Explicitly register critical MIME types for modern browsers & module scripts
mimetypes.init()
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/x-icon", ".ico")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

ROOT = Path(__file__).resolve().parent

# Check candidate production directories (static_dist is never ignored by git/tools)
def get_serve_directory():
    candidates = [
        ROOT / "static_dist",
        ROOT / "dist",
    ]
    for c in candidates:
        if c.is_dir() and (c / "index.html").is_file():
            print(f"[BitX Server] Servindo arquivos compilados de: {c}")
            return c
    
    # Try building if npm is available
    print("[BitX Server] Diretório compilado não encontrado. Tentando compilar...")
    try:
        subprocess.run(["npm", "run", "build"], cwd=str(ROOT), check=True)
        if (ROOT / "dist" / "index.html").is_file():
            return ROOT / "dist"
    except Exception as e:
        print(f"[BitX Server] Não foi possível compilar via npm: {e}")
    
    print(f"[BitX Server] Fallback para raiz: {ROOT}")
    return ROOT

SERVE_DIR = get_serve_directory()

class SinglePageAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SERVE_DIR), **kwargs)

    def guess_type(self, path):
        # Force strict JavaScript and CSS MIME types
        path_str = str(path).lower()
        if path_str.endswith(".js") or path_str.endswith(".mjs"):
            return "application/javascript"
        if path_str.endswith(".css"):
            return "text/css"
        if path_str.endswith(".json"):
            return "application/json"
        if path_str.endswith(".png"):
            return "image/png"
        if path_str.endswith(".svg"):
            return "image/svg+xml"
        if path_str.endswith(".ico"):
            return "image/x-icon"
        return super().guess_type(path)

    def do_GET(self):
        # Strip query and hash
        raw_path = self.path.split("?", 1)[0].split("#", 1)[0]

        # Health check endpoint for Render monitoring
        if raw_path == "/healthz" or raw_path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","network":"mainnet","service":"bitx-core-live"}')
            return

        # Target file resolution
        rel_path = raw_path.lstrip("/")
        target = (SERVE_DIR / rel_path).resolve()

        # If requested file exists, serve it with proper MIME headers
        if target.is_file() and str(target).startswith(str(SERVE_DIR)):
            return super().do_GET()

        # Otherwise serve index.html for Single Page Application routing
        self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self):
        raw_path = self.path.split("?", 1)[0].split("#", 1)[0]
        target = (SERVE_DIR / raw_path.lstrip("/")).resolve()
        if target.is_file() and str(target).startswith(str(SERVE_DIR)):
            return super().do_HEAD()
        self.path = "/index.html"
        return super().do_HEAD()

    def do_POST(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"status":"success","message":"BitX Core Mainnet Gateway Online"}')

def run():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), SinglePageAppHandler)
    print(f"BitX Core Mainnet Web Service rodando com sucesso na porta {port}...")
    server.serve_forever()

if __name__ == "__main__":
    run()
