import httpx
import asyncio
import json
import time

async def test():
    async with httpx.AsyncClient(timeout=120) as client:
        testcases = ["Verify_A", "Verify_B", "Verify_C"]
        run_id = f"test_run_{int(time.time())}"
        for tc in testcases:
            payload = {
                "base_url": "https://example.com",
                "browser": "chromium",
                "headless": True,
                "test": {
                    "test_name": tc,
                    "screenshot_suite_id": run_id,
                    "steps": [
                        {"action": "goto", "url": "/"},
                        {"action": "screenshot"}
                    ]
                }
            }
            res = await client.post("http://127.0.0.1:8000/api/v1/ai/generate-and-run", json=payload)
            print(f"[{tc}] Status: {res.status_code}")
            if res.status_code == 200:
                data = res.json()
                print(f"[{tc}] API Response (screenshot_url): {data.get('execution_result', {}).get('screenshot_url')}")
            else:
                print(f"[{tc}] Error: {res.text}")

if __name__ == "__main__":
    asyncio.run(test())
