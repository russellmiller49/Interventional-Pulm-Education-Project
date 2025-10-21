#!/usr/bin/env python3
"""
Comprehensive fix for Mermaid diagrams:
1. Remove <br/> tags from Mermaid blocks
2. Replace ± with "with" or "and" in Mermaid blocks
3. Replace en dashes (–) with hyphens (-) in Mermaid blocks
"""
import re
import glob

def fix_mermaid_comprehensive(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all mermaid code blocks and fix them
    def fix_mermaid_block(match):
        mermaid_block = match.group(0)
        
        # Remove <br/> and <br> tags
        mermaid_block = re.sub(r'<br\s*\/?>', ' ', mermaid_block, flags=re.IGNORECASE)
        
        # Replace ± with "with" or "and" (context-dependent)
        mermaid_block = re.sub(r'(\w+)\s*±\s*(\w+)', r'\1 with \2', mermaid_block)
        mermaid_block = re.sub(r'±\s*(\w+)', r'with \1', mermaid_block)
        
        # Replace en dashes (–) with hyphens (-)
        mermaid_block = re.sub(r'–', '-', mermaid_block)
        
        return mermaid_block

    # Process mermaid blocks
    content = re.sub(
        r'```mermaid\n.*?```',
        fix_mermaid_block,
        content,
        flags=re.DOTALL
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Fixed: {filepath}")

# Process all MDX files
for filepath in glob.glob('content/modules/board/*.mdx'):
    fix_mermaid_comprehensive(filepath)

print("\n✓ All Mermaid diagrams comprehensively fixed!")





