from pathlib import Path
lines = Path('repo.diff').read_text().splitlines()
if len(lines) < 2:
    raise SystemExit('diff too short')
header = '\n'.join(lines[:2]) + '\n'
body = lines[2:]
split_idx = None
for idx, line in enumerate(body):
    if line.startswith('@@ -583'):
        split_idx = idx
        break
if split_idx is None:
    raise SystemExit('split index not found')
our_lines = body[:split_idx]
existing_lines = body[split_idx:]
Path('our_patch.diff').write_text(header + '\n'.join(our_lines) + '\n')
Path('existing_patch.diff').write_text(header + '\n'.join(existing_lines) + '\n')
