"""Merge IMLS outlets with NJ State Library system data into data/nj-libraries.json.

Outlets are the unit. System-level fields (website, legal-help program) are joined onto
each outlet by normalized system name. Existing outreach, services, hours, and admin
contact fields in the current data/nj-libraries.json are preserved by (fscskey, fscs_seq)
so a re-run never loses progress.

Accepted community proposals in data/proposals/accepted.json are applied after the join.

Usage:
  python3 scripts/merge.py <imls-outlets.json> <njsl-systems.json> <out.json>
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


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


NAME_NOISE = re.compile(r"\b(free|public|library|libraries|of|the|system|branch|memorial|and|&|twp|township)\b|[^a-z0-9 ]")

# IMLS system_name -> NJSL system_name. Only high-confidence pairs.
SYSTEM_ALIASES = {
    "ALFRED H. BAUMANN LIBRARY/WEST PATERSO": "Alfred H. Baumann Library",
    "ANTHONY PIO COSTA MEMORIAL LIBRARY": "Fairfield Free Public Library – Anthony Pio Costa Memorial Library",
    "BEDMINSTER-FAR HILLS": "Bedminster-Far Hills/ Clarence Dillon Public Library",
    "DOWDELL LIBRARY OF SOUTH AMBOY": "Sadie Pope Dowdell Library of South Amboy",
    "DWIGHT D. EISENHOWER LIBRARY": "Dwight D. Eisenhower Library – Totowa",
    "FRANKLIN TWP PUBLIC LIBRARY/SOMERSET": "Franklin Township Public Library-Somerset",
    "HARDING TOWNSHIP LIBRARY": "Kemmerer Library Harding Township Library",
    "HOLLAND TOWNSHIP FREE PUBLIC LIBRARY": "Holland Alexandria Free Public Library",
    "JAMES H. JOHNSON MEMORIAL LIBRARY": "Deptford James H. Johnson Memorial Library",
    "JOHN F. KENNEDY MEMORIAL LIBRARY": "Wallington – J. F. Kennedy Memorial Library",
    "LIBRARY COMPANY OF BURLINGTON": "Burlington, Library Company of",
    "LOUIS BAY 2ND LIBRARY": "Louis Bay 2nd Library – Hawthorne",
    "MARGARET E. HEGGAN FREE PUBLIC LIBRARY": "Washington Township – Margaret E. Heggan Free Public Library",
    "MARIE FLECHE MEMORIAL LIBRARY": "Berlin – Marie Fleche Memorial Library",
    "MCCOWAN MEMORIAL LIBRARY": "Pitman – McCowan Memorial Library",
    "MENDHAM FREE PUBLIC LIBRARY": "Mendham Boro Free Public Library",
    "MONROE TWP PUBLIC LIBRARY/GLOUCESTER": "Monroe Township Free Public Library-Gloucester",
    "MONROE TWP PUBLIC LIBRARY/MIDDLESEX": "Monroe Township Public Library-Middlesex",
    "MORRISTOWN-MORRIS TWP JOINT PUBLIC LIBRARY": "Morristown-Morris Township Joint Public Library",
    "POMPTON LAKES BOROUGH FREE PUBLIC LIBRARY": "Pompton Lakes Library",
    "ROSELLE PARK VETERAN`S MEMORIAL LIBRARY": "Roselle Park Veterans Memorial Library",
    "ROXBURY PUBLIC LIBRARY": "Roxbury Township Public Library",
    "RUTH L. ROCKWOOD MEMORIAL LIBRARY": "Livingston Library – Ruth L. Rockwood Memorial Library",
    "WASHINGTON TWP PUBLIC LIBRARY/BERGEN": "Washington Township Public Library-Bergen",
    "WASHINGTON TWP PUBLIC LIBRARY/MORRIS": "Washington Township Public Library-Morris",
    "WORTH PINKHAM MEMORIAL LIBRARY": "Ho-Ho-Kus Worth Pinkham Memorial Library",
}

# IMLS administrative entities that are not in the NJSL public-libraries directory
# (checked 2026-09-18 against data/njsl-systems.json). They stay in the IMLS
# universe with null website/legal-help rather than a guessed alias.
UNLISTED_SYSTEMS = {
    "BASS RIVER COMMUNITY LIBRARY",
    "BEVERLY FREE LIBRARY",
    "CLEMENTON MEMORIAL LIBRARY",
    "CRESSKILL PUBLIC LIBRARY",
    "CROSSWICKS LIBRARY COMPANY",
    "FLORENCE TOWNSHIP LIBRARY",
    "GIBBSBORO PUBLIC LIBRARY",
    "GILL MEMORIAL LIBRARY",
    "HIGH BRIDGE PUBLIC LIBRARY",
    "KEYPORT FREE PUBLIC LIBRARY",
    "LONGPORT PUBLIC LIBRARY",
    "MANASQUAN PUBLIC LIBRARY",
    "NEWFIELD PUBLIC LIBRARY",
    "OAKLYN MEMORIAL LIBRARY",
    "RIVERSIDE PUBLIC LIBRARY",
    "SALLY STRETCH KEEN MEMORIAL LIBRARY",
    "SEA BRIGHT LIBRARY",
    "SPRING LAKE PUBLIC LIBRARY",
    "UNION BEACH MEMORIAL LIBRARY",
    "W.H. WALTERS FREE PUBLIC LIBRARY",
}
PRESERVE_KEYS = (
    "services",
    "hours",
    "resources",
    "proposed_hours_note",
    "admin_phone",
    "admin_email",
    "contact_form_url",
    "director",
    "board_url",
    "municipality_code",
)
SERVICE_NAMES = {
    "legal-help desk",
    "lawyer-in-the-library",
    "notary",
    "passport",
    "printing/scanning",
    "meeting rooms",
    "tax prep",
    "language help",
    "computer access",
    "other",
}


def normalize_name(name: str) -> str:
    """Collapse a library name to a stable join key. Pure."""
    return " ".join(NAME_NOISE.sub(" ", name.lower()).split())


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_json_list(path: Path) -> list[dict[str, object]]:
    data = load_json(path)
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


def index_preserved(existing: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    out: dict[str, dict[str, object]] = {}
    for row in existing:
        key = f"{row.get('fscskey')}-{row.get('fscs_seq')}"
        out[key] = {k: row[k] for k in PRESERVE_KEYS if k in row}
    return out


def merge(
    outlets: list[dict[str, object]],
    systems: dict[str, SystemInfo],
    outreach: dict[str, Outreach],
    preserved: dict[str, dict[str, object]],
) -> tuple[list[dict[str, object]], list[str]]:
    merged: list[dict[str, object]] = []
    unmatched: list[str] = []
    for outlet in outlets:
        system_name = outlet.get("system_name")
        if not isinstance(system_name, str):
            raise ValueError(f"outlet missing system_name: {outlet}")
        lookup = SYSTEM_ALIASES.get(system_name, system_name)
        info = systems.get(normalize_name(lookup))
        if info is None and system_name not in UNLISTED_SYSTEMS:
            unmatched.append(system_name)
        key = f"{outlet.get('fscskey')}-{outlet.get('fscs_seq')}"
        prior = outreach.get(key, Outreach())
        prior_fields = preserved.get(key, {})
        row: dict[str, object] = {
            **outlet,
            "website": info.website if info else None,
            "catalog_url": info.catalog_url if info else None,
            "library_card_signup_url": info.library_card_signup_url if info else None,
            "has_legal_help_program": info.has_legal_help_program if info else None,
            "legal_help_evidence": info.legal_help_evidence if info else None,
            "outreach": {"status": prior.status, "notes": prior.notes},
            "services": prior_fields.get("services"),
            "hours": prior_fields.get("hours"),
            "resources": prior_fields.get("resources"),
            "proposed_hours_note": prior_fields.get("proposed_hours_note"),
            "admin_phone": prior_fields.get("admin_phone"),
            "admin_email": prior_fields.get("admin_email"),
            "contact_form_url": prior_fields.get("contact_form_url"),
            "director": prior_fields.get("director"),
            "board_url": prior_fields.get("board_url"),
            "municipality_code": prior_fields.get("municipality_code") or outlet.get("municipality_code"),
        }
        merged.append(row)
    merged.sort(key=lambda r: (str(r.get("county") or ""), str(r.get("system_name") or ""), str(r.get("outlet_name") or "")))
    return merged, sorted(set(unmatched))


def _http_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        if " " not in raw:
            return raw
    return None


def apply_proposals(merged: list[dict[str, object]], proposals: list[dict[str, object]]) -> int:
    by_key = {f"{r.get('fscskey')}-{r.get('fscs_seq')}": r for r in merged}
    applied = 0
    for prop in proposals:
        key = prop.get("outlet_key")
        kind = prop.get("kind")
        value = prop.get("value")
        if not isinstance(key, str) or not isinstance(kind, str) or not isinstance(value, str):
            continue
        row = by_key.get(key)
        if row is None:
            continue
        if kind == "service":
            name = value.strip()
            if name not in SERVICE_NAMES and not name.startswith("other:"):
                continue
            services = row.get("services")
            if not isinstance(services, list):
                services = []
            if not any(isinstance(s, dict) and s.get("name") == name for s in services):
                services.append({
                    "name": name,
                    "evidence_url": _http_url(prop.get("evidence_url")),
                    "verified_on": prop.get("verified_on") if isinstance(prop.get("verified_on"), str) else None,
                })
            row["services"] = services
            applied += 1
        elif kind == "hours":
            row["proposed_hours_note"] = value.strip()
            applied += 1
        elif kind == "resource":
            resources = row.get("resources")
            if not isinstance(resources, list):
                resources = []
            resources.append({"name": value.strip(), "evidence_url": _http_url(prop.get("evidence_url"))})
            row["resources"] = resources
            applied += 1
        else:
            raise ValueError(f"unknown proposal kind: {kind}")
    return applied


def seed_from_legal_and_phone(merged: list[dict[str, object]]) -> None:
    """Fill services from legal-help flags and admin_phone from IMLS phone when missing."""
    for row in merged:
        services = row.get("services")
        if not isinstance(services, list):
            services = []
        if row.get("has_legal_help_program") is True and not any(
            isinstance(s, dict) and s.get("name") == "legal-help desk" for s in services
        ):
            evidence = row.get("legal_help_evidence")
            services.append({
                "name": "legal-help desk",
                "evidence_url": _http_url(evidence),
                "verified_on": None,
            })
        row["services"] = services or None

        if row.get("admin_phone") is None:
            phone = row.get("phone")
            if isinstance(phone, str) and phone.strip():
                row["admin_phone"] = {"value": phone.strip(), "verified_on": None}


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    imls_path, njsl_path, out_path = Path(argv[1]), Path(argv[2]), Path(argv[3])
    outlets = load_json_list(imls_path)
    systems = index_systems(load_json_list(njsl_path))
    existing = load_json_list(out_path) if out_path.exists() else []
    merged, unmatched = merge(outlets, systems, index_outreach(existing), index_preserved(existing))
    proposals_path = Path(__file__).resolve().parent.parent / "data" / "proposals" / "accepted.json"
    applied = 0
    if proposals_path.exists():
        raw = load_json(proposals_path)
        if not isinstance(raw, list):
            raise ValueError(f"{proposals_path}: expected a JSON array")
        applied = apply_proposals(merged, raw)
    seed_from_legal_and_phone(merged)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(merged, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(json.dumps({
        "outlets": len(merged),
        "systems_in_directory": len(systems),
        "outlets_without_system_match": sum(1 for r in merged if r["website"] is None and r["has_legal_help_program"] is None),
        "unmatched_system_names": unmatched,
        "accepted_proposals_applied": applied,
        "out": str(out_path),
    }, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
