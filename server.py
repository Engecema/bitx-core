from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
USERS_FILE = "usuarios_config.json"
if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, "w") as f: json.dump({"admin": "bitx123"}, f)

class AuthHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        self.do_OPTIONS()
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        with open(USERS_FILE, 'r') as f:
            users = json.load(f)

        action = data.get('action')
        u, p = data.get('user'), data.get('password')

        if action == 'register':
            users[u] = p
            with open(USERS_FILE, 'w') as f: json.dump(users, f)
            response = {"status": "success", "message": "Cadastrado globalmente"}
        elif action == 'login':
            if users.get(u) == p:
                response = {"status": "success", "message": "Acesso concedido"}
            else:
                response = {"status": "error", "message": "Incorreto"}

        self.wfile.write(json.dumps(response).encode('utf-8'))

def run():
    server = HTTPServer(('0.0.0.0', 8080), AuthHandler)
    print("Servidor BitX Core rodando na porta 8080...")
    server.serve_forever()

if __name__ == '__main__':
    run()
