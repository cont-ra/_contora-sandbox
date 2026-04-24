#!/usr/bin/env python3
"""HTTP server with Range request support for video seeking."""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class RangeHTTPRequestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        file_size = os.path.getsize(path)
        range_header = self.headers.get('Range')

        if range_header:
            start, end = 0, file_size - 1
            range_spec = range_header.replace('bytes=', '')
            parts = range_spec.split('-')
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1

            self.send_response(206)
            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
            self.send_header('Content-Length', str(end - start + 1))
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()

            f = open(path, 'rb')
            f.seek(start)
            return f
        else:
            self.send_response(200)
            self.send_header('Content-Length', str(file_size))
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            return open(path, 'rb')

if __name__ == '__main__':
    print("Starting server with Range support on http://localhost:8080")
    HTTPServer(('', 8080), RangeHTTPRequestHandler).serve_forever()
