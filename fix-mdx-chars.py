#!/usr/bin/env python3
"""
Fix MDX files by properly escaping < and > characters that break MDX parsing.
This script only escapes characters in regular text, not in code blocks.
"""
import re
import glob

def fix_mdx_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Strategy: Split on code fences, process text parts only
    parts = []
    lines = content.split('\n')
    in_code = False
    current_block = []

    for line in lines:
        if line.startswith('```'):
            if in_code:
                # End of code block
                current_block.append(line)
                parts.append(('code', '\n'.join(current_block)))
                current_block = []
                in_code = False
            else:
                # Start of code block - save any pending text first
                if current_block:
                    parts.append(('text', '\n'.join(current_block)))
                    current_block = []
                current_block.append(line)
                in_code = True
        else:
            current_block.append(line)

    # Don't forget last block
    if current_block:
        block_type = 'code' if in_code else 'text'
        parts.append((block_type, '\n'.join(current_block)))

    # Now process each part
    result_lines = []
    for block_type, block_content in parts:
        if block_type == 'text':
            # Escape < and > in text, but be smart about it
            # Replace patterns like <number, <=, >=, etc.
            block_content = re.sub(r'<(?=\d)', '&lt;', block_content)  # < followed by digit
            block_content = re.sub(r'<=', '&lt;=', block_content)      # <=
            block_content = re.sub(r'>=', '&gt;=', block_content)      # >=
            block_content = re.sub(r'>(?=\d)', '&gt;', block_content)  # > followed by digit
            block_content = re.sub(r'<~', '&lt;~', block_content)      # <~
        result_lines.append(block_content)

    result = '\n'.join(result_lines)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)

    print(f"Fixed: {filepath}")

# Process all board review MDX files
for filepath in glob.glob('content/modules/board/*.mdx'):
    fix_mdx_file(filepath)

print("\n✓ All files processed!")





