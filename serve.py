#!/usr/bin/env python3
import http.server
import socketserver
import os
import base64

PORT = 8080

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching to match original serve script behavior
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_POST(self):
        if self.path == '/shot':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            
            # Remove data URI prefix if present
            if post_data.startswith('data:image/png;base64,'):
                post_data = post_data[len('data:image/png;base64,'):]
            
            try:
                img_data = base64.b64decode(post_data)
                with open('shot.png', 'wb') as f:
                    f.write(img_data)
                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b"OK")
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

# Explicitly register mime types
MyHandler.extensions_map.update({
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
})

if __name__ == '__main__':
    # ThreadingHTTPServer, NOT TCPServer: the single-threaded server handles one
    # request at a time, so Mapbox GL's parallel tile/worker fetches queue behind
    # each other and the map intermittently never fires 'load'. Same cause made
    # gallery images hang mid-download.
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    http.server.ThreadingHTTPServer.daemon_threads = True
    with http.server.ThreadingHTTPServer(("", PORT), MyHandler) as httpd:
        print(f"Serving at http://localhost:{PORT} (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server.")
