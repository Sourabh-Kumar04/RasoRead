import urllib.request
import json
import os

try:
    req = urllib.request.Request("http://localhost:8000/reader/7850c6de-0bbc-4b54-ba46-710022a8d3e9/page?page=36")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode("utf-8"))
        for i, p in enumerate(data.get("paragraphs", [])[:10]):
            text = p.get("text", "")
            print(f"[{i}] {text}")
except Exception as e:
    print("Error:", e)
