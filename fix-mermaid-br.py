#!/usr/bin/env python3
"""
Remove <br/> tags from Mermaid code blocks only.
"""
import re
import glob

def fix_mermaid_br_tags(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all mermaid code blocks and remove <br/> tags within them
    def remove_br_in_mermaid(match):
        mermaid_block = match.group(0)
        # Remove <br/> and <br> tags
        mermaid_block = re.sub(r'<br\s*\/?>', ' ', mermaid_block, flags=re.IGNORECASE)
        return mermaid_block

    # Process mermaid blocks
    content = re.sub(
        r'```mermaid\n.*?```',
        remove_br_in_mermaid,
        content,
        flags=re.DOTALL
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Fixed: {filepath}")

# Process all MDX files
for filepath in glob.glob('content/modules/board/*.mdx'):
    fix_mermaid_br_tags(filepath)

print("\n✓ All Mermaid <br/> tags removed!")


