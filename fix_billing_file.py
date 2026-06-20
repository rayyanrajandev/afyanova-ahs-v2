import re

with open('resources/js/pages/billing-service-catalog/Index.vue', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all </script> tags
script_end_positions = [m.start() for m in re.finditer(r'</script>', content)]
print(f'Found {len(script_end_positions)} </script> tags')

if len(script_end_positions) > 1:
    # Cut at the FIRST </script> and discard everything after (the duplicate)
    first_script_end = script_end_positions[0]
    content = content[:first_script_end + 9]
    print(f'Keeping content up to first </script> at position {first_script_end}')
    print(f'New file length: {len(content)}')

with open('resources/js/pages/billing-service-catalog/Index.vue', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')