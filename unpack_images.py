#!/usr/bin/env python3
"""Unpack images.json (path -> dataURL) into images/img/... directory tree."""
import base64
import json
import os
import sys

src = sys.argv[1] if len(sys.argv) > 1 else 'images.json'
data = json.load(open(src))
n = 0
for path, data_url in data.items():
    if ',' not in data_url:
        continue
    b64 = data_url.split(',', 1)[1]
    dest = 'images/img' + path
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(base64.b64decode(b64))
    n += 1
print(f'unpacked {n} images into images/img/')
