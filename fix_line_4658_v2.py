#!/usr/bin/env python3
import sys

# File path
file_path = r"C:\Portfolio\afyanova-ahs-v2\resources\js\pages\patients\Index.vue"

# Read the file as binary first to understand encoding
with open(file_path, 'rb') as f:
    raw_data = f.read()

# Try to decode as UTF-8
try:
    text_content = raw_data.decode('utf-8')
    lines = text_content.split('\n')
    
    print(f"Successfully read file with UTF-8 encoding")
    print(f"Total lines: {len(lines)}")
    print(f"\n=== BEFORE FIX ===")
    print(f"Line 4658 (index 4657) length: {len(lines[4657])}")
    if len(lines[4657]) > 0:
        print(f"First 200 chars: {repr(lines[4657][:200])}")
    
    # Replace line 4658 
    new_line = "                        <!-- PRIMARY INTAKE STRIP -->"
    lines[4657] = new_line
    
    # Write back
    new_content = '\n'.join(lines)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"\n=== AFTER FIX ===")
    print(f"Replacement line written: {repr(new_line)}")
    
    # Verify the fix
    with open(file_path, 'r', encoding='utf-8') as f:
        verify_content = f.read()
    
    verify_lines = verify_content.split('\n')
    
    print(f"\n=== VERIFICATION (Lines 4656-4660) ===")
    for i in range(4655, min(4660, len(verify_lines))):
        line_num = i + 1
        line_content = verify_lines[i]
        if len(line_content) > 100:
            preview = line_content[:100] + f"... (total {len(line_content)} chars)"
        else:
            preview = line_content
        print(f"Line {line_num}: {repr(preview)}")
    
    print(f"\n=== Line 4658 Verification ===")
    print(f"Line 4658 content: {repr(verify_lines[4657])}")
    print(f"Expected:          {repr('                        <!-- PRIMARY INTAKE STRIP -->')}")
    print(f"Match: {verify_lines[4657] == new_line}")
    
    if verify_lines[4657].strip() == "<!-- PRIMARY INTAKE STRIP -->":
        print(f"\n✓ FIX SUCCESSFUL! Line 4658 is now clean.")
    else:
        print(f"\n✗ Fix verification failed")
        sys.exit(1)
        
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
