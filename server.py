import http.server
import socketserver
import mimetypes

class MyRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def guess_type(self, path):
        mime_type, _ = mimetypes.guess_type(path)
        if mime_type == 'text/plain' and path.endswith('.js'):
            return 'application/javascript'
        return mime_type

PORT = 8000

Handler = MyRequestHandler
httpd = socketserver.TCPServer(("", PORT), Handler)

print(f"Serving at port {PORT}")
httpd.serve_forever()
