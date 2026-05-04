#!/usr/bin/env python3
"""
Fix corrupted UTF-8 characters on line 4658 of Index.vue
"""
import sys
import os

def fix_file():
    file_path = r"C:\Portfolio\afyanova-ahs-v2\resources\js\pages\patients\Index.vue"
    
    print("=" * 70)
    print("FIXING LINE 4658 IN INDEX.VUE")
    print("=" * 70)
    
    # Read the file with UTF-8 encoding and error handling
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"ERROR reading file: {e}")
        return False
    
    print(f"\n✓ File read successfully")
    print(f"  Total lines: {len(lines)}")
    
    # Show BEFORE
    print(f"\n--- BEFORE ---")
    print(f"Line 4658:")
    print(f"  Length: {len(lines[4657])} characters")
    print(f"  Content (first 100 chars): {repr(lines[4657][:100])}")
    print(f"  Content (last 50 chars): {repr(lines[4657][-50:])}")
    
    # Get the indentation from the current line
    indent = "                        "  # 24 spaces based on other lines
    
    # Replace line 4658
    old_line = lines[4657]
    lines[4657] = f"{indent}<!-- PRIMARY INTAKE STRIP -->\n"
    
    print(f"\n✓ Line 4658 replaced")
    print(f"  New content: {repr(lines[4657])}")
    
    # Write the file back
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print(f"\n✓ File written successfully")
    except Exception as e:
        print(f"ERROR writing file: {e}")
        return False
    
    # VERIFY
    print(f"\n--- AFTER (VERIFICATION) ---")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines_verify = f.readlines()
    except Exception as e:
        print(f"ERROR verifying: {e}")
        return False
    
    print(f"Line 4658:")
    print(f"  Content: {repr(lines_verify[4657])}")
    print(f"  Length: {len(lines_verify[4657])} characters")
    
    # Show surrounding context
    print(f"\n--- CONTEXT (Lines 4656-4660) ---")
    for i in range(4655, min(4660, len(lines_verify))):
        line_num = i + 1
        content = lines_verify[i].rstrip('\n')
        # Truncate long lines for display
        display = content if len(content) <= 70 else content[:67] + "..."
        print(f"Line {line_num}: {display}")
    
    print(f"\n" + "=" * 70)
    print("✓ FIX COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = fix_file()
    sys.exit(0 if success else 1)
