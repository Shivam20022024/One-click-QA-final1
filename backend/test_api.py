import json
import urllib.request

payload = {
    "test_name": "Test",
    "base_url": "https://www.saucedemo.com",
    "steps": [
        {"action": "goto", "selector": "", "value": "https://www.saucedemo.com/"}
    ],
    "browsers": ["chromium"],
    "devices": ["Desktop"],
    "project_id": 1
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/run-multi-test",
    data=data,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer mock"
    }
)

try:
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode('utf-8'))