#!/usr/bin/env python3
# Fix line 4658 in Index.vue

file_path = r"C:\Portfolio\afyanova-ahs-v2\resources\js\pages\patients\Index.vue"

# Read the file with UTF-8 encoding
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines in file: {len(lines)}")
print(f"\n--- BEFORE: Lines 4656-4660 ---")
for i in range(4655, min(4660, len(lines))):
    line_preview = lines[i][:80] + "..." if len(lines[i]) > 80 else lines[i]
    print(f"Line {i+1}: {repr(line_preview)}")

# Replace line 4658 (index 4657)
replacement_line = "                        <!-- PRIMARY INTAKE STRIP -->\n"
lines[4657] = replacement_line

# Write back to file
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n--- AFTER: Lines 4656-4660 ---")
# Verify by reading the file again
with open(file_path, 'r', encoding='utf-8') as f:
    lines_verify = f.readlines()

for i in range(4655, min(4660, len(lines_verify))):
    line_preview = lines_verify[i][:80] + "..." if len(lines_verify[i]) > 80 else lines_verify[i]
    print(f"Line {i+1}: {repr(line_preview)}")

print(f"\n✓ Fix applied successfully!")
print(f"Line 4658 is now: {repr(lines_verify[4657])}")
