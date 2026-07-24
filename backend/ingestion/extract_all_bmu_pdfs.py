"""Driver: extract text from all downloaded BMU PDFs, write to a manifest JSON
in the bmu_pages.json shape ({tenant_slug, tenant_name, pages: [...]}), one
file written incrementally so a crash partway through doesn't lose earlier
work. Run ingestion.ingest --pages on the output afterward.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.extract_pdf import extract

PDF_DIR = Path(__file__).resolve().parent.parent / "samples" / "pdfs"
OUT_PATH = Path(__file__).resolve().parent.parent / "samples" / "bmu_pdfs.json"
DOWNLOAD_BASE = "https://www.bmu.edu.in/wp-content/themes/bmu-theme/assets/downloads"

# (local filename, original URL filename, title)
DOCUMENTS = [
    ("BMU_Annual_Report_2024-25_Without_FR.pdf", "BMU_Annual_Report_2024-25_Without_FR.pdf", "BMU Annual Report 2024-25"),
    ("brochure_b-tech.pdf", "brochure_b-tech.pdf", "B.Tech Programme Brochure"),
    ("brochure_b-tech-electronics-computer-engineering.pdf", "brochure_b-tech-electronics-computer-engineering.pdf", "B.Tech Electronics & Computer Engineering Brochure"),
    ("brochure_b-tech-mechanical-engineering.pdf", "brochure_b-tech-mechanical-engineering.pdf", "B.Tech Mechanical Engineering Brochure"),
    ("brochure_ba-hons-liberal-studies_1.pdf", "brochure_ba-hons-liberal-studies_1.pdf", "BA (Hons) Liberal Studies Brochure (Alternate Edition)"),
    ("brochure_ba-llb.pdf", "brochure_ba-llb.pdf", "BA LLB / BBA LLB (Hons) Law Programmes Brochure"),
    ("brochure_bba.pdf", "brochure_bba.pdf", "BBA (Hons) / Integrated BBA-MBA Brochure"),
    ("brochure_bcom.pdf", "brochure_bcom.pdf", "B.Com (Hons) Brochure"),
    ("brochure_btech.pdf", "brochure_btech.pdf", "B.Tech Programme Overview Brochure"),
    ("brochure_llb-hons.pdf", "brochure_llb-hons.pdf", "LLB (Hons) Brochure"),
    ("brochure_llb.pdf", "brochure_llb.pdf", "LLB Brochure"),
    ("brochure_mapp.pdf", "brochure_mapp.pdf", "MA Public Policy (MAPP) Brochure"),
    ("brochure_mba.pdf", "brochure_mba.pdf", "MBA Brochure"),
    ("brochure_mba_v1.pdf", "brochure_mba.pdf_1", "MBA Brochure (Alternate Edition)"),
    ("Btech-CCE-brochure.pdf", "Btech-CCE-brochure.pdf", "B.Tech Computer & Communication Engineering (CCE) Brochure"),
    ("Executive-MBA-2025_Final.pdf", "Executive-MBA-2025_Final.pdf", "Executive MBA Brochure 2025"),
    ("Executive-MBA-Brochure.pdf", "Executive-MBA-Brochure.pdf", "Executive MBA Brochure"),
    ("Faculty_Application_Form.pdf", "Faculty_Application_Form.pdf", "Faculty Application Form"),
    ("Gateway_Magazine_2025_revised.pdf", "Gateway_Magazine_2025_revised.pdf", "Gateway Magazine 2025"),
    ("July_2024.pdf", "July_2024.pdf", "BMU Newsletter -- July 2024"),
    ("March_2025.pdf", "March_2025.pdf", "BMU Newsletter -- March 2025"),
    ("wil-bmu-brochure.pdf", "wil-bmu-brochure.pdf", "Work Integrated Learning (WIL) Brochure"),
]


def load_existing() -> dict:
    if OUT_PATH.exists():
        return json.loads(OUT_PATH.read_text(encoding="utf-8"))
    return {"tenant_slug": "bmu", "tenant_name": "BML Munjal University", "pages": []}


def save(manifest: dict) -> None:
    OUT_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    manifest = load_existing()
    done_titles = {p["title"] for p in manifest["pages"]}

    for local_name, url_name, title in DOCUMENTS:
        if title in done_titles:
            print(f"skip (already extracted): {title}")
            continue

        path = PDF_DIR / local_name
        if not path.exists():
            print(f"MISSING FILE, skipping: {local_name}")
            continue

        t0 = time.time()
        print(f"extracting: {title} ({local_name}) ...", flush=True)
        try:
            text = extract(str(path))
        except Exception as e:
            print(f"  FAILED: {e}")
            continue

        elapsed = time.time() - t0
        print(f"  done in {elapsed:.1f}s, {len(text)} chars")

        manifest["pages"].append(
            {
                "source_url": f"{DOWNLOAD_BASE}/{url_name}",
                "title": title,
                "content": text,
            }
        )
        save(manifest)  # incremental save after every document

    print(f"\nwrote {len(manifest['pages'])} pages to {OUT_PATH}")


if __name__ == "__main__":
    main()
