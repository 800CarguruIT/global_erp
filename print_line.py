from pathlib import Path
for line in Path('repo.diff').read_text().splitlines():
    if 'updateTransferDraft' in line:
        print(repr(line))
        break
