"""Local review server: serves the Atlas folder read-only, but /airoli-rtp/twin/web/models/<plan>/ from a staging dir.
    python3 serve_review.py <atlas root> <staging models dir> <port>"""
import http.server, os, sys, functools
ROOT, STAGE, PORT = sys.argv[1], sys.argv[2], int(sys.argv[3]); SHOTS = sys.argv[4] if len(sys.argv) > 4 else '/tmp/shots'
PREFIX = '/airoli-rtp/twin/web/models/'
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p.startswith(PREFIX):
            rel = p[len(PREFIX):]; cand = os.path.join(STAGE, rel)
            if os.path.exists(cand): return cand
        return super().translate_path(path)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_POST(self):          # /__save?name=x.jpg : a data-URL body from the page, written to the shots dir
        import urllib.parse, base64, re
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query); name = re.sub(r'[^A-Za-z0-9_.-]', '_', q.get('name', ['shot.jpg'])[0])
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = base64.b64decode(body.split(',', 1)[1]); os.makedirs(SHOTS, exist_ok=True); open(os.path.join(SHOTS, name), 'wb').write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(H, directory=ROOT)).serve_forever()
