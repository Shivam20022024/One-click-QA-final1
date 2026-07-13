import json
import re
import os

transcript_path = r"C:\Users\Shivam kumar\.gemini\antigravity-ide\brain\fda8667d-0cb8-4e66-aebf-07af423587e7\.system_generated\logs\transcript.jsonl"
target_file = r"c:\Users\Shivam kumar\Downloads\Nova-Test-Suite-Generator-UI-redesign (2)\Nova-Test-Suite-Generator-UI-redesign\frontend\src\pages\Reports\ReportDetails.jsx"

content_lines = {}
view_file_count = 0

try:
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                entry = json.loads(line)
                if 'content' in entry and isinstance(entry['content'], str):
                    content_str = entry['content']
                    if 'ReportDetails.jsx' in content_str and 'The following code has been modified' in content_str:
                        view_file_count += 1
                        lines = content_str.split('\n')
                        matched_in_this_event = 0
                        for l in lines:
                            match = re.match(r'^(\d+):\s?(.*)$', l)
                            if match:
                                num = int(match.group(1))
                                content_lines[num] = match.group(2)
                                matched_in_this_event += 1
                        print(f"Event {view_file_count}: matched {matched_in_this_event} lines.")
            except Exception as e:
                pass
                
    if content_lines:
        max_line = max(content_lines.keys())
        final_lines = []
        for i in range(1, max_line + 1):
            final_lines.append(content_lines.get(i, ''))
            
        with open(target_file, 'w', encoding='utf-8') as out:
            out.write('\n'.join(final_lines))
        print(f"Restored file successfully to {max_line} lines. Total keys: {len(content_lines)}")
        print(f"File size: {os.path.getsize(target_file)} bytes")
    else:
        print("Could not find the original content in the transcript.")
except Exception as e:
    print(f"Error: {e}")
