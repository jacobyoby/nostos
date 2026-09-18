"""Ingest IMLS Public Libraries Survey (PLS) FY2023 outlet data for New Jersey.

Downloads the FY2023 PLS CSV package, filters to NJ outlets that are not
temporarily closed, and writes nj-libraries.json plus nj-libraries.meta.json.

Re-run: python3 ingest_imls_nj.py
"""

import csv
import json
import os
import subprocess
import zipfile
from dataclasses import dataclass

SOURCE_URL = "https://www.imls.gov/sites/default/files/2025-08/pls_fy2023_csv.zip"
SCRATCH_DIR = "/private/tmp/claude-501/-Users-jacobrakai/53493178-4ca2-414c-b685-059e5141673b/scratchpad/nostos-imls"
ZIP_PATH = os.path.join(SCRATCH_DIR, "pls_fy2023_csv.zip")
CSV_DIR = os.path.join(SCRATCH_DIR, "CSV")
OUTLET_CSV_PATH = os.path.join(CSV_DIR, "pls_fy23_outlet_pud23i.csv")
AE_CSV_PATH = os.path.join(CSV_DIR, "PLS_FY23_AE_pud23i.csv")
OUTPUT_JSON_PATH = os.path.join(SCRATCH_DIR, "nj-libraries.json")
META_JSON_PATH = os.path.join(SCRATCH_DIR, "nj-libraries.meta.json")
RELEASE_YEAR = "FY2023"
STATE_ABBR = "NJ"
EXCLUDED_STATSTRU_CODE = "23"  # Structure Change Code: temporary closure

OUTLET_TYPE_MAP: dict[str, str] = {
    "CE": "central",
    "BR": "branch",
    "BS": "bookmobile",
    "BM": "books-by-mail",
}


@dataclass
class LibraryOutlet:
    fscskey: str
    fscs_seq: str
    system_name: str
    outlet_name: str
    outlet_type: str
    address: str | None
    city: str | None
    zip: str | None
    county: str | None
    phone: str | None
    lat: float | None
    lon: float | None
    hours_open_weekly: float | None
    source_year: str


def clean_string(value: str) -> str | None:
    trimmed = value.strip()
    if trimmed == "" or trimmed == "-1" or trimmed == "-3" or trimmed == "-4":
        return None
    return trimmed


MISSING_NUMERIC_CODES = {"-1", "-3", "-4", "-9"}


def clean_float(value: str) -> float | None:
    trimmed = value.strip()
    if trimmed == "" or trimmed in MISSING_NUMERIC_CODES:
        return None
    try:
        return float(trimmed)
    except ValueError:
        return None


def ensure_source_file_downloaded() -> None:
    if os.path.exists(OUTLET_CSV_PATH):
        return
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    subprocess.run(
        ["curl", "-sSL", "-o", ZIP_PATH, SOURCE_URL],
        check=True,
    )
    with zipfile.ZipFile(ZIP_PATH) as archive:
        archive.extractall(SCRATCH_DIR)


def parse_outlet_row(row: dict[str, str], system_names_by_fscskey: dict[str, str]) -> LibraryOutlet:
    weekly_hours_raw = clean_float(row["HOURS"])
    weekly_hours = weekly_hours_raw / 52.0 if weekly_hours_raw is not None else None
    fscskey = row["FSCSKEY"].strip()
    return LibraryOutlet(
        fscskey=fscskey,
        fscs_seq=row["FSCS_SEQ"].strip(),
        system_name=system_names_by_fscskey.get(fscskey, row["LIBNAME"].strip()),
        outlet_name=row["LIBNAME"].strip(),
        outlet_type=OUTLET_TYPE_MAP[row["C_OUT_TY"].strip()],
        address=clean_string(row["ADDRESS"]),
        city=clean_string(row["CITY"]),
        zip=clean_string(row["ZIP"]),
        county=clean_string(row["CNTY"]),
        phone=clean_string(row["PHONE"]),
        lat=clean_float(row["LATITUDE"]),
        lon=clean_float(row["LONGITUD"]),
        hours_open_weekly=weekly_hours,
        source_year=RELEASE_YEAR,
    )


def load_system_names_by_fscskey() -> dict[str, str]:
    with open(AE_CSV_PATH, encoding="latin-1") as csv_file:
        reader = csv.DictReader(csv_file)
        return {row["FSCSKEY"].strip(): row["LIBNAME"].strip() for row in reader}


def load_nj_outlets() -> tuple[list[LibraryOutlet], int, int]:
    system_names_by_fscskey = load_system_names_by_fscskey()
    with open(OUTLET_CSV_PATH, encoding="latin-1") as csv_file:
        reader = csv.DictReader(csv_file)
        all_rows = list(reader)

    row_count_before_filter = len(all_rows)
    nj_rows = [row for row in all_rows if row["STABR"].strip() == STATE_ABBR]
    active_nj_rows = [
        row for row in nj_rows if row["STATSTRU"].strip() != EXCLUDED_STATSTRU_CODE
    ]
    outlets = [parse_outlet_row(row, system_names_by_fscskey) for row in active_nj_rows]
    return outlets, row_count_before_filter, len(active_nj_rows)


def write_outlets_json(outlets: list[LibraryOutlet]) -> None:
    payload = [
        {
            "fscskey": outlet.fscskey,
            "fscs_seq": outlet.fscs_seq,
            "system_name": outlet.system_name,
            "outlet_name": outlet.outlet_name,
            "outlet_type": outlet.outlet_type,
            "address": outlet.address,
            "city": outlet.city,
            "zip": outlet.zip,
            "county": outlet.county,
            "phone": outlet.phone,
            "lat": outlet.lat,
            "lon": outlet.lon,
            "hours_open_weekly": outlet.hours_open_weekly,
            "source_year": outlet.source_year,
        }
        for outlet in outlets
    ]
    with open(OUTPUT_JSON_PATH, "w") as json_file:
        json.dump(payload, json_file, indent=2)


def write_meta_json(row_count_before_filter: int, row_count_after_filter: int) -> None:
    meta = {
        "source_url": SOURCE_URL,
        "file_name": "pls_fy23_outlet_pud23i.csv",
        "release_year": RELEASE_YEAR,
        "row_count_before_filter": row_count_before_filter,
        "row_count_after_filter": row_count_after_filter,
        "filter_rule": (
            f"STABR == '{STATE_ABBR}' AND STATSTRU != '{EXCLUDED_STATSTRU_CODE}' "
            "(STATSTRU 23 = Structure Change Code for temporary closure per "
            "PLS-FY-2023-Data-Documentation-508.pdf)"
        ),
        "ingest_script_path": os.path.join(SCRATCH_DIR, "ingest_imls_nj.py"),
    }
    with open(META_JSON_PATH, "w") as meta_file:
        json.dump(meta, meta_file, indent=2)


def main() -> None:
    ensure_source_file_downloaded()
    outlets, row_count_before_filter, row_count_after_filter = load_nj_outlets()
    write_outlets_json(outlets)
    write_meta_json(row_count_before_filter, row_count_after_filter)
    print(f"NJ outlets written: {row_count_after_filter} (of {row_count_before_filter} national rows)")


if __name__ == "__main__":
    main()
