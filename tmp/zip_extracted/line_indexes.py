from pathlib import Path
lines = Path('repo.diff').read_text().splitlines()
for idx in range(len(lines)):
    if 150 <= idx <= 175:
        print(idx, repr(lines[idx]))
