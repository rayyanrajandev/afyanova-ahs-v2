#!/usr/bin/env python3
import os

# File path
file_path = r"C:\Portfolio\afyanova-ahs-v2\resources\js\pages\patients\Index.vue"

# Read the file with UTF-8 encoding
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
print(f"\n--- BEFORE ---")
print(f"Line 4658 length: {len(lines[4657])}")
print(f"Line 4658 first 80 chars: {lines[4657][:80]}")

# Replace line 4658 (index 4657)
lines[4657] = "                        <!-- PRIMARY INTAKE STRIP -->\n"

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n--- AFTER ---")
# Verify
with open(file_path, 'r', encoding='utf-8') as f:
    lines_verify = f.readlines()

print(f"Line 4658 content: {lines_verify[4657]}")
print(f"\nVerification - Lines 4656-4660:")
for i in range(4655, min(4660, len(lines_verify))):
    preview = lines_verify[i][:80] if len(lines_verify[i]) > 80 else lines_verify[i]
    print(f"Line {i+1}: {repr(preview)}")

print(f"\n✓ Fix completed successfully!")
