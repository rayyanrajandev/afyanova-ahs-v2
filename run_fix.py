#!/usr/bin/env python3
"""
Script to fix line 4658 in Index.vue which contains corrupted UTF-8 characters
"""

file_path = r"C:\Portfolio\afyanova-ahs-v2\resources\js\pages\patients\Index.vue"

print("="*60)
print("FIXING LINE 4658 IN INDEX.VUE")
print("="*60)

try:
    # Read the file
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    print(f"\n✓ Successfully read file: {file_path}")
    print(f"  Total lines: {len(lines)}")
    
    # Show before
    print(f"\n--- BEFORE FIX ---")
    print(f"Line 4658 length: {len(lines[4657])} characters")
    before_content = lines[4657][:100]
    print(f"First 100 chars: {repr(before_content)}")
    
    # Apply fix
    lines[4657] = "                        <!-- PRIMARY INTAKE STRIP -->\n"
    print(f"\n✓ Line 4658 replaced with clean comment")
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"✓ File written successfully")
    
    # Verify
    print(f"\n--- AFTER FIX ---")
    with open(file_path, 'r', encoding='utf-8') as f:
        lines_verify = f.readlines()
    
    print(f"Line 4658 content: {repr(lines_verify[4657])}")
    print(f"Line 4658 length: {len(lines_verify[4657])} characters")
    
    # Show context
    print(f"\nContext (Lines 4656-4660):")
    print("-" * 60)
    for i in range(4655, min(4660, len(lines_verify))):
        line_num = i + 1
        content = lines_verify[i].rstrip('\n')
        if len(content) > 70:
            content = content[:67] + "..."
        print(f"  {line_num}: {content}")
    
    print("\n" + "="*60)
    print("✓ FIX COMPLETED SUCCESSFULLY!")
    print("="*60)
    
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    import traceback
    traceback.print_exc()
