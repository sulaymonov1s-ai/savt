#!/usr/bin/env python3
"""Static file server with CORS enabled (for paths.json)."""
from http.server import HTTPServer, SimpleHTTPRequestHandler


class CORSHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


HTTPServer(('0.0.0.0', 12001), CORSHandler).serve_forever()
