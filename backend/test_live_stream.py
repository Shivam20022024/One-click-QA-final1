import asyncio
import uuid
import httpx
import websockets
import json

async def test_live_stream():
    execution_id = f"suite_exec_{uuid.uuid4().hex[:8]}"
    print(f"Generated Execution ID: {execution_id}")

    # Start listening to websocket first
    ws_url = f"ws://127.0.0.1:8000/ws/executions/{execution_id}"
    
    async def listen_ws():
        try:
            async with websockets.connect(ws_url) as websocket:
                print("Connected to WebSocket! Waiting for frames...")
                frames_received = 0
                while True:
                    message = await websocket.recv()
                    data = json.loads(message)
                    if data.get("event") == "frame":
                        frames_received += 1
                        print(f"Received frame {frames_received} from {data.get('source_execution_id')}!")
                        if frames_received >= 5:
                            print("Successfully verified live streaming functionality!")
                            return True
                    else:
                        print(f"Received log: {data.get('event')} - {data.get('action', '')}")
        except Exception as e:
            print(f"WebSocket error: {e}")
            return False

    listen_task = asyncio.create_task(listen_ws())
    
    # Wait a tiny bit for websocket to connect
    await asyncio.sleep(1)
    
    # Trigger execution via API
    payload = {
        "test_name": "Demo Smoke Test",
        "base_url": "https://example.com",
        "steps": [
            {"action": "navigate", "selector": "", "value": "https://example.com"},
            {"action": "wait", "selector": "", "value": "2000"}
        ],
        "browsers": ["chromium"],
        "devices": ["Desktop"],
        "environment": "Production",
        "project_id": 1,
        "execution_id": execution_id
    }
    
    print("Triggering test execution...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post("http://127.0.0.1:8000/execute/multi", json=payload)
            print(f"Execution API response: {response.status_code}")
    except Exception as e:
        print(f"API error: {e}")
        
    await listen_task

if __name__ == "__main__":
    asyncio.run(test_live_stream())
