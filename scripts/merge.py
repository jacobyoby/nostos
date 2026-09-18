"""Merge IMLS outlets with NJ State Library system data into data/nj-libraries.json.

Outlets are the unit. System-level fields (website, legal-help program) are joined onto
each outlet by normalized system name. Existing outreach status in the current
data/nj-libraries.json is preserved by (fscskey, fscs_seq) so a re-run never loses progress.

Usage:
  python3 scripts/merge.py <imls-outlets.json> <njsl-systems.json> <out.json>
"""

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class SystemInfo:
    website: str | None
    catalog_url: str | None
    library_card_signup_url: str | None
    has_legal_help_program: bool | None
    legal_help_evidence: str | None


@dataclass
class Outreach:
    status: str = "todo"
    notes: str | None = None


NAME_NOISE = re.compile(r"\b(free|public|library|libraries|of|the|system|branch|memorial|and|&)\b|[^a-z0-9 ]")


def normalize_name(name: str) -> str:
    """Collapse a library name to a stable join key. Pure."""
    return " ".join(NAME_NOISE.sub(" ", name.lower()).split())


def load_json(path: Path) -> list[dict[str, object]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"{path}: expected a JSON array, got {type(data).__name__}")
    return data


def index_systems(rows: list[dict[str, object]]) -> dict[str, SystemInfo]:
    out: dict[str, SystemInfo] = {}
    for row in rows:
        name = row.get("system_name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"system row missing system_name: {row}")
        out[normalize_name(name)] = SystemInfo(
            website=row.get("website") if isinstance(row.get("website"), str) else None,
            catalog_url=row.get("catalog_url") if isinstance(row.get("catalog_url"), str) else None,
            library_card_signup_url=row.get("library_card_signup_url") if isinstance(row.get("library_card_signup_url"), str) else None,
            has_legal_help_program=row.get("has_legal_help_program") if isinstance(row.get("has_legal_help_program"), bool) else None,
            legal_help_evidence=row.get("legal_help_evidence") if isinstance(row.get("legal_help_evidence"), str) else None,
        )
    return out


def index_outreach(existing: list[dict[str, object]]) -> dict[str, Outreach]:
    out: dict[str, Outreach] = {}
    for row in existing:
        key = f"{row.get('fscskey')}-{row.get('fscs_seq')}"
        raw = row.get("outreach")
        if isinstance(raw, dict):
            status = raw.get("status")
            notes = raw.get("notes")
            out[key] = Outreach(
                status=status if isinstance(status, str) else "todo",
                notes=notes if isinstance(notes, str) else None,
            )
    return out


def merge(outlets: list[dict[str, object]], systems: dict[str, SystemInfo], outreach: dict[str, Outreach]) -> tuple[list[dict[str, object]], list[str]]:
    merged: list[dict[str, object]] = []
    unmatched: list[str] = []
    for outlet in outlets:
        system_name = outlet.get("system_name")
        if not isinstance(system_name, str):
            raise ValueError(f"outlet missing system_name: {outlet}")
        info = systems.get(normalize_name(system_name))
        if info is None:
            unmatched.append(system_name)
        key = f"{outlet.get('fscskey')}-{outlet.get('fscs_seq')}"
        prior = outreach.get(key, Outreach())
        merged.append({
            **outlet,
            "website": info.website if info else None,
            "catalog_url": info.catalog_url if info else None,
            "library_card_signup_url": info.library_card_signup_url if info else None,
            "has_legal_help_program": info.has_legal_help_program if info else None,
            "legal_help_evidence": info.legal_help_evidence if info else None,
            "outreach": {"status": prior.status, "notes": prior.notes},
        })
    merged.sort(key=lambda r: (str(r.get("county") or ""), str(r.get("system_name") or ""), str(r.get("outlet_name") or "")))
    return merged, sorted(set(unmatched))


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    imls_path, njsl_path, out_path = Path(argv[1]), Path(argv[2]), Path(argv[3])
    outlets = load_json(imls_path)
    systems = index_systems(load_json(njsl_path))
    existing = load_json(out_path) if out_path.exists() else []
    merged, unmatched = merge(outlets, systems, index_outreach(existing))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(merged, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(json.dumps({
        "outlets": len(merged),
        "systems_in_directory": len(systems),
        "outlets_without_system_match": sum(1 for r in merged if r["website"] is None and r["has_legal_help_program"] is None),
        "unmatched_system_names": unmatched,
        "out": str(out_path),
    }, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
