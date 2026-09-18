"""Record Forma Pauperis outreach progress for one library outlet.

Usage:
  python3 scripts/outreach.py <fscskey>-<fscs_seq> <todo|contacted|posted|partner> "<note>"

Edits data/nj-libraries.json in place. The key is shown as data-fscs on each row of src/index.html.
"""

import json
import sys
from pathlib import Path

STATUSES = ("todo", "contacted", "posted", "partner")
DATA = Path(__file__).resolve().parent.parent / "data" / "nj-libraries.json"


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    key, status, note = argv[1], argv[2], argv[3]
    if status not in STATUSES:
        raise ValueError(f"status must be one of {STATUSES}, got {status!r}")
    with DATA.open(encoding="utf-8") as handle:
        rows = json.load(handle)
    hits = [r for r in rows if f"{r.get('fscskey')}-{r.get('fscs_seq')}" == key]
    if len(hits) != 1:
        raise KeyError(f"expected exactly one outlet with key {key}, found {len(hits)}")
    hits[0]["outreach"] = {"status": status, "notes": note or None}
    with DATA.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(f"{hits[0]['outlet_name']} ({hits[0]['system_name']}): {status}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
