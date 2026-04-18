"""
PHYLIS data acquisition from phyllis.nl.

Uses PHYLIS's internal AJAX endpoints:
  - GET /Browse/JsonNodes?id={class_id}  — tree navigation
  - GET /Biomass/View/{sample_id}        — sample detail HTML

The tree root is class_101. Nodes with children=true are categories;
leaf nodes have icon="leaf" and id="sample_{N}".
"""

import json
import time
import re
from pathlib import Path

import httpx

BASE_URL = "https://phyllis.nl"
RAW_DATA_DIR = Path(__file__).parent / "raw_data"
TREE_ROOT = "class_101"


def ensure_raw_data_dir():
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)


def fetch_children(client: httpx.Client, node_id: str) -> list[dict]:
    """Fetch child nodes for a given category node."""
    resp = client.get(f"{BASE_URL}/Browse/JsonNodes", params={"id": node_id})
    resp.raise_for_status()
    return resp.json()


def walk_tree(
    client: httpx.Client,
    node_id: str,
    path: list[str],
    rate_limit: float = 0.3,
) -> list[dict]:
    """
    Recursively walk the PHYLIS category tree.

    Returns a flat list of leaf (sample) nodes, each annotated with
    its full taxonomy path.
    """
    children = fetch_children(client, node_id)
    time.sleep(rate_limit)

    samples = []
    for child in children:
        child_id = child["id"]
        child_text = child["text"]

        if child.get("icon") == "leaf" and child_id.startswith("sample_"):
            # Leaf node — individual sample
            sample_num = child_id.replace("sample_", "")
            samples.append({
                "sample_id": int(sample_num),
                "name": child_text,
                "taxonomy_path": path + [child_text],
                "category_id": node_id,
            })
        elif child.get("children"):
            # Category node — recurse
            deeper = walk_tree(client, child_id, path + [child_text], rate_limit)
            samples.extend(deeper)

    return samples


def fetch_sample_html(client: httpx.Client, sample_id: int) -> str:
    """Fetch the full HTML detail page for a sample."""
    resp = client.get(f"{BASE_URL}/Biomass/View/{sample_id}")
    resp.raise_for_status()
    return resp.text


def parse_sample_html(html: str, sample_id: int) -> dict:
    """
    Parse a PHYLIS sample detail page into structured data.

    Extracts:
      - metadata: material name, submitter, literature/citation, ash type, remarks
      - properties: name, unit, basis, ar/dry/daf values
    """
    result = {
        "sample_id": sample_id,
        "material": "",
        "submitter": None,
        "literature": None,
        "literature_url": None,
        "ash_type": None,
        "remarks": None,
        "properties": [],
    }

    # Extract metadata from <th>/<td> pairs
    meta_patterns = {
        "material": r'<th>Material</th>\s*<td[^>]*>(.*?)</td>',
        "submitter": r'<th>Submitter organisation</th>\s*<td[^>]*>(.*?)</td>',
        "ash_type": r'<th>Ash type</th>\s*<td[^>]*>(.*?)</td>',
        "remarks": r'<th>Remarks</th>\s*<td[^>]*>(.*?)</td>',
    }
    for key, pattern in meta_patterns.items():
        match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
        if match:
            value = re.sub(r'<[^>]+>', '', match.group(1)).strip()
            if value:
                result[key] = value

    # Extract literature/citation — may contain URL
    lit_match = re.search(
        r'<th>Literature</th>\s*<td[^>]*>(.*?)</td>',
        html, re.DOTALL | re.IGNORECASE,
    )
    if lit_match:
        lit_html = lit_match.group(1)
        url_match = re.search(r'href="([^"]+)"', lit_html)
        if url_match:
            result["literature_url"] = url_match.group(1)
        lit_text = re.sub(r'<[^>]+>', '', lit_html).strip()
        if lit_text:
            result["literature"] = lit_text

    # Extract year from literature text
    if result["literature"]:
        year_match = re.search(r'\((\d{4})\)', result["literature"])
        if year_match:
            result["literature_year"] = int(year_match.group(1))

    # Extract property values using a chunk-based approach.
    # Split the HTML at each property row (td colspan="9") and parse
    # the chunk between consecutive properties.

    # Find all property row positions
    prop_positions = [(m.start(), m.group(1)) for m in re.finditer(
        r'<td colspan="9">(.*?)</td>', html
    )]

    for idx, (pos, prop_name_raw) in enumerate(prop_positions):
        prop_name = re.sub(r'<[^>]+>', '', prop_name_raw).strip()
        if not prop_name or prop_name == "Property":
            continue

        # Get the chunk from this property to the next (or +500 chars)
        end_pos = prop_positions[idx + 1][0] if idx + 1 < len(prop_positions) else pos + 500
        chunk = html[pos:end_pos]

        # Extract unit from the first <td> after the property name
        unit = ""
        unit_match = re.search(r'</td>\s*<td>(.*?)(?:</td>|$)', chunk, re.DOTALL)
        if unit_match:
            unit = re.sub(r'<[^>]+>', '', unit_match.group(1)).strip()
            # Clean up multiline unit text
            unit = re.sub(r'\s+', ' ', unit).strip()

        # Detect basis hint (ar), (dry), (ash) in the unit/surrounding text
        basis_hint = None
        basis_match = re.search(r'\((ar|dry|daf|ash)\)', chunk[:200])
        if basis_match:
            basis_hint = basis_match.group(1)

        # Extract AR value (td with class "number ar-value" or "number water-value")
        ar_val = None
        ar_match = re.search(
            r'class="number (?:ar-value|water-value)"[^>]*>\s*([\d\s.,+-]+)',
            chunk, re.DOTALL,
        )
        if ar_match:
            ar_val = _parse_number(ar_match.group(1))

        # Check for colspan="3" value (ash chemistry uses a single cell spanning all 3 basis columns)
        colspan3_match = re.search(
            r'<td class="number"\s+colspan="3">([\d\s.,+-]+)</td>', chunk
        )
        colspan3_val = None
        if colspan3_match:
            colspan3_val = _parse_number(colspan3_match.group(1))

        # Extract dry and DAF values (plain "number" class tds WITHOUT colspan)
        non_ar_values = re.findall(
            r'<td class="number">([\d\s.,+-]*)</td>', chunk
        )
        dry_val = None
        daf_val = None
        value_idx = 0
        for raw_val in non_ar_values:
            parsed = _parse_number(raw_val)
            if parsed is not None:
                if value_idx == 0:
                    dry_val = parsed
                elif value_idx == 1:
                    daf_val = parsed
                value_idx += 1
                if value_idx >= 2:
                    break

        # Clean unit — remove basis hints
        clean_unit = re.sub(r'\s*\((?:ar|dry|daf|ash)\)', '', unit).strip() or "wt%"

        # Build property entries for each non-null basis
        if colspan3_val is not None:
            # Single value spanning all basis columns (ash chemistry, trace elements)
            basis = basis_hint if basis_hint else "dry"
            result["properties"].append({
                "name": prop_name,
                "unit": clean_unit,
                "basis": basis,
                "value": colspan3_val,
            })
        else:
            if ar_val is not None:
                basis = basis_hint if basis_hint else "ar"
                result["properties"].append({
                    "name": prop_name,
                    "unit": clean_unit,
                    "basis": basis,
                    "value": ar_val,
                })
            if dry_val is not None:
                result["properties"].append({
                    "name": prop_name,
                    "unit": clean_unit,
                    "basis": "dry",
                    "value": dry_val,
                })
            if daf_val is not None:
                result["properties"].append({
                    "name": prop_name,
                    "unit": clean_unit,
                    "basis": "daf",
                    "value": daf_val,
                })

    return result


def _parse_number(s: str) -> float | None:
    """Parse a number string from PHYLIS HTML, handling spaces as thousands separators."""
    s = s.strip()
    if not s or s == '-':
        return None
    # PHYLIS uses spaces as thousands separator (e.g. "2 500.0")
    s = s.replace(' ', '').replace(',', '')
    try:
        return float(s)
    except ValueError:
        return None


def scrape_all(rate_limit: float = 0.3, save_html: bool = True):
    """
    Full PHYLIS scrape: walk tree, fetch all sample pages, parse properties.

    Saves:
      - raw_data/tree.json — full tree with sample metadata
      - raw_data/samples/{id}.html — raw HTML for each sample
      - raw_data/parsed_samples.json — structured data for all samples
    """
    ensure_raw_data_dir()

    with httpx.Client(
        timeout=30.0,
        headers={"User-Agent": "BiomassIQ/0.1 (research tool)"},
        follow_redirects=True,
    ) as client:
        # 1. Walk the tree
        print("Walking PHYLIS category tree from root...")
        samples_index = walk_tree(client, TREE_ROOT, [])

        with open(RAW_DATA_DIR / "tree.json", "w") as f:
            json.dump(samples_index, f, indent=2)
        print(f"  Found {len(samples_index)} samples across the tree")

        # 2. Fetch and parse each sample
        if save_html:
            (RAW_DATA_DIR / "samples").mkdir(exist_ok=True)

        parsed_samples = []
        errors = []

        for i, entry in enumerate(samples_index):
            sid = entry["sample_id"]

            if i % 100 == 0:
                print(f"  [{i+1}/{len(samples_index)}] Fetching sample #{sid}...")

            try:
                html = fetch_sample_html(client, sid)

                if save_html:
                    with open(RAW_DATA_DIR / f"samples/{sid}.html", "w") as f:
                        f.write(html)

                parsed = parse_sample_html(html, sid)
                parsed["taxonomy_path"] = entry["taxonomy_path"]
                parsed["category_id"] = entry["category_id"]
                parsed_samples.append(parsed)

            except Exception as e:
                errors.append({"sample_id": sid, "error": str(e)})
                print(f"    Error on #{sid}: {e}")

            time.sleep(rate_limit)

        # 3. Save parsed results
        with open(RAW_DATA_DIR / "parsed_samples.json", "w") as f:
            json.dump(parsed_samples, f, indent=2)

        if errors:
            with open(RAW_DATA_DIR / "errors.json", "w") as f:
                json.dump(errors, f, indent=2)

        print(f"\nDone: {len(parsed_samples)} samples parsed, {len(errors)} errors")
        print(f"Total properties extracted: {sum(len(s['properties']) for s in parsed_samples)}")

    return parsed_samples


if __name__ == "__main__":
    scrape_all()
