# Scripts Directory

## generate-gitingest.py

A Python script to generate token-budget friendly gitingest markdown files for LLM/context ingestion.

### Usage

Generate the base curated gitingest file:

```bash
python3 scripts/generate-gitingest.py
```

Generate both base and detailed gitingest files:

```bash
python3 scripts/generate-gitingest.py --details
```

Generate only the detailed file (skip base):

```bash
python3 scripts/generate-gitingest.py --no-base --details
```

Custom output paths:

```bash
python3 scripts/generate-gitingest.py --output custom-gitingest.md --details-output custom-details.md
```

### Options

- `--output OUTPUT` - Path for base gitingest output (default: `gitingest.md`)
- `--no-base` - Skip generating the base gitingest.md file
- `--details` - Also generate a detailed gitingest file
- `--details-output OUTPUT` - Path for details output (default: `gitingest_details.md`)
- `--details-include DIR` - Directory to include in details scan (can be repeated)
- `--details-max-bytes BYTES` - Max file size to include (default: 200000)
- `--details-max-files FILES` - Max files to inline (default: 75)
- `--details-inline MODE` - Inline mode: `none`, `curated`, or `all` (default: `curated`)

### What it does

1. **Base gitingest.md**:
   - Repository tree structure (excluding build artifacts, node_modules, etc.)
   - Inlines important configuration and documentation files
   - Token-budget friendly for initial context

2. **gitingest_details.md** (with `--details`):
   - More granular file listing
   - Inlines source code files from `src/`, `content/`, `scripts/`
   - Useful for deeper LLM context when needed

### Requirements

- Python 3.6+
- Git (for branch/commit info)
