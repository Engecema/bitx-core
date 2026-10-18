#!/usr/bin/env python3
"""
Production SPA Server for Render
Serves the Vite production build from dist/ with SPA fallback to index.html.
Uses only Python standard library.
"""
import os
import sys
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", 3000))
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class SPARequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        # Extract requested path without query string or hash
        clean_path = self.path.split('?')[0].split('#')[0]
        local_path = os.path.join(DIST_DIR, clean_path.lstrip('/'))

        # If file exists and is a file, serve it directly
        if os.path.isfile(local_path):
            return super().do_GET()

        # If it's a directory with index.html, serve it
        if os.path.isdir(local_path) and os.path.isfile(os.path.join(local_path, "index.html")):
            return super().do_GET()

        # SPA Fallback: serve dist/index.html for client-side routing
        index_file = os.path.join(DIST_DIR, "index.html")
        if os.path.isfile(index_file):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            with open(index_file, "rb") as f:
                self.wfile.write(f.read())
            return

        # If dist directory doesn't exist yet, return a helpful status
        self.send_response(503)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Build em andamento ou diretorio dist/ nao encontrado. Verifique o build command.")

    def log_message(self, format, *args):
        # Simple logging to stdout
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stdout.flush()

def run():
    # If dist doesn't exist, try building it if npm is available
    if not os.path.exists(DIST_DIR):
        print(f"[Render Server] Diretorio {DIST_DIR} nao encontrado. Tentando compilar via npm...")
        import subprocess
        try:
            subprocess.run(["npm", "run", "build"], check=True)
        except Exception as e:
            print(f"[Render Server] Aviso: nao foi possivel rodar npm run build automaticamente: {e}")

    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, SPARequestHandler)
    print(f"🚀 [BitX Core] Servidor ativo em http://0.0.0.0:{PORT} (servindo {DIST_DIR})")
    sys.stdout.flush()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
        httpd.server_close()

if __name__ == "__main__":
    run()
