#!/usr/bin/env python3
"""
Test script to validate DOM capture functionality.
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from api.ai_routes import _capture_dom_elements

async def test_dom_capture():
    """Test DOM capture from a sample URL."""
    try:
        print("Testing DOM capture from https://httpbin.org/forms/post...")
        elements = await _capture_dom_elements("https://httpbin.org/forms/post")
        print(f"Captured {len(elements)} elements")

        if elements:
            print("Sample elements:")
            for i, elem in enumerate(elements[:3]):
                print(f"  {i+1}. {elem}")

        print("DOM capture test completed successfully!")

    except Exception as e:
        print(f"DOM capture test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dom_capture())