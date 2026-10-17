import os
import sys
import json
import urllib.request
import urllib.error
import base64
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

# BitX Daemon RPC Configuration from Environment Variables
RPC_HOST = os.environ.get("BITX_RPC_HOST", "").strip()
RPC_PORT = os.environ.get("BITX_RPC_PORT", "8332").strip()
RPC_USER = os.environ.get("BITX_RPC_USER", "bitx_mainnet_admin").strip()
RPC_PASS = os.environ.get("BITX_RPC_PASS", "btxc_prod_sec_auth_2026!").strip()

def call_daemon_rpc(method, params=None):
    if not RPC_HOST:
        return {"error": "Nenhum host de nó daemon configurado (BITX_RPC_HOST vazio)", "connected": False}
    
    url = f"http://{RPC_HOST}:{RPC_PORT}/"
    payload = json.dumps({
        "jsonrpc": "1.0",
        "id": "bitx_portal",
        "method": method,
        "params": params or []
    }).encode("utf-8")
    
    auth_str = f"{RPC_USER}:{RPC_PASS}"
    auth_header = "Basic " + base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": auth_header
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=4) as response:
            result = json.loads(response.read().decode("utf-8"))
            return {"result": result.get("result"), "error": result.get("error"), "connected": True}
    except Exception as e:
        return {"error": str(e), "connected": False}

class SinglePageAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SERVE_DIR), **kwargs)

    def guess_type(self, path):
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
        raw_path = self.path.split("?", 1)[0].split("#", 1)[0]

        # Health check endpoint for Render monitoring
        if raw_path == "/healthz" or raw_path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","network":"mainnet","service":"bitx-core-live"}')
            return

        # Daemon node status check
        if raw_path == "/api/node/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            
            if not RPC_HOST:
                resp = {
                    "connected": False,
                    "mode": "standalone_interface",
                    "message": "Nó daemon físico não configurado. Defina BITX_RPC_HOST no Render para conectar ao servidor Linux da blockchain.",
                    "rpc_host": None,
                    "target_chain": "BitX Core Mainnet (PoW SHA-256d)"
                }
            else:
                rpc_res = call_daemon_rpc("getblockchaininfo")
                if rpc_res.get("connected"):
                    resp = {
                        "connected": True,
                        "mode": "live_daemon",
                        "rpc_host": RPC_HOST,
                        "data": rpc_res.get("result"),
                        "message": "Conectado ao nó daemon físico da BitX Core em produção!"
                    }
                else:
                    resp = {
                        "connected": False,
                        "mode": "connecting_failed",
                        "rpc_host": RPC_HOST,
                        "error": rpc_res.get("error"),
                        "message": f"Tentativa de conexão ao nó {RPC_HOST}:{RPC_PORT} falhou ou timed out."
                    }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # Target file resolution
        rel_path = raw_path.lstrip("/")
        target = (SERVE_DIR / rel_path).resolve()

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
        raw_path = self.path.split("?", 1)[0].split("#", 1)[0]
        
        # RPC Proxy endpoint for frontend calling real blockchain daemon
        if raw_path == "/api/rpc":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            try:
                data = json.loads(body.decode("utf-8"))
                method = data.get("method")
                params = data.get("params", [])
                rpc_response = call_daemon_rpc(method, params)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(rpc_response).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"status":"success","message":"BitX Core Mainnet Gateway Online"}')

def run():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(("0.0.0.0", port), SinglePageAppHandler)
    print(f"BitX Core Mainnet Web Service rodando com sucesso na porta {port}...")
    if RPC_HOST:
        print(f"[BitX Server] Conexão com nó daemon configurada para: http://{RPC_HOST}:{RPC_PORT}")
    else:
        print("[BitX Server] BITX_RPC_HOST não configurado. Rodando em modo standalone integrado.")
    server.serve_forever()

if __name__ == "__main__":
    run()
