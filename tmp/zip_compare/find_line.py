from pathlib import Path
for idx, line in enumerate(Path('repo.diff').read_text().splitlines()):
    if 'updateTransferDraft' in line:
        print(idx, repr(line))
        break
