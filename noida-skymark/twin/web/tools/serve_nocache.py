#!/usr/bin/env python3
"""Static server for local checks of the twin viewer: serves the repo root (the page needs /engine/vendor and
the tenant folders) with caching off, so edited ES modules are always fetched fresh. Usage: serve_nocache.py [port]"""
import http.server, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass
    def do_POST(self):                         # /__review?name=x.jpg with a data URL body: saves a frame into twin/web/_review (local checks only)
        import base64, re, urllib.parse
        q = urllib.parse.urlparse(self.path); name = urllib.parse.parse_qs(q.query).get('name', [''])[0]
        if q.path != '/__review' or not re.fullmatch(r'[\w.-]{1,80}\.(jpg|png)', name): self.send_response(404); self.end_headers(); return
        body = self.rfile.read(int(self.headers['Content-Length'])).decode()
        open(os.path.join('noida-skymark', 'twin', 'web', '_review', name), 'wb').write(base64.b64decode(body.split(',', 1)[1]))
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8137), H).serve_forever()
