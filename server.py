import json
import urllib.request
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer

def rpc_call(m, p=[]):
    rpc_url = 'http://127.0.0.1:18443'
    auth = base64.b64encode(b'bitxuser:bitxpassword').decode('utf-8')
    data = json.dumps({'jsonrpc': '2.0', 'id': 'site', 'method': m, 'params': p}).encode('utf-8')
    req = urllib.request.Request(rpc_url, data=data, headers={'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as res:
            parsed = json.loads(res.read().decode('utf-8'))
            return parsed.get('result', parsed)
    except Exception as e:
        return {'error': str(e)}

class BridgeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        if self.path == '/info': res = rpc_call('getblockchaininfo')
        elif self.path == '/balance': res = rpc_call('getbalance')
        else: res = {'error': 'Rota nao encontrada'}
        self.wfile.write(json.dumps(res).encode('utf-8'))

if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8000), BridgeHandler).serve_forever()
