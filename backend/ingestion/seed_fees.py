"""One-off structured-extract seed for BMU's fee structure page.

Per CLAUDE.md: numeric facts (fees) should be pulled from a typed table
rather than extracted from embedded prose, for reliability. This hand-enters
the same figures already ingested as prose in bmu_pages.json -- duplication
is intentional, the two layers serve different purposes (prose for RAG
retrieval, this table for future FeeBreakdown/ComparisonTable blocks that
read structured data directly).

Usage: python -m ingestion.seed_fees
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json

from db import get_or_create_tenant, tenant_connection

ACADEMIC_YEAR = "2026-27"

# (programme_name, tuition_annual_inr, tuition_total_inr, foreign_annual_usd,
#  foreign_total_usd, hostel_double_inr, hostel_triple_inr,
#  hostel_double_usd, hostel_triple_usd)
ROWS = [
    ("B.Tech (CSE)", 410000, 1640000, 7100, 28400, 236000, 225000, 4100, 3900),
    ("B.Tech (EComE / Mechanical)", 365000, 1460000, 6300, 25200, 236000, 225000, 4100, 3900),
    ("BBA LLB (Hons) / BA LLB (Hons)", 390000, 1950000, 6750, 33750, 236000, 225000, 4100, 3900),
    ("LLB", 250000, 750000, 4500, 13500, 236000, 225000, 4100, 3900),
    ("BBA (Hons)", 350000, 1400000, 6050, 24200, 236000, 225000, 4100, 3900),
    ("B.Com (Hons)", 250000, 1000000, 4350, 17400, 236000, 225000, 4100, 3900),
    ("BA (Hons) Liberal Studies", 550000, 2200000, 9500, 38000, 236000, 225000, 4100, 3900),
    ("MBA", 755000, 1510000, 13050, 26100, None, None, None, None),
]


def seed() -> None:
    tenant_id = get_or_create_tenant("bmu", "BML Munjal University")
    print(f"tenant: BML Munjal University ({tenant_id})")

    with tenant_connection(tenant_id) as (conn, cur):
        cur.execute("delete from programme_fees where tenant_id = %s", (tenant_id,))

        for (
            name,
            tuition_annual,
            tuition_total,
            foreign_annual,
            foreign_total,
            hostel_double,
            hostel_triple,
            hostel_double_usd,
            hostel_triple_usd,
        ) in ROWS:
            cur.execute(
                """
                insert into programme_fees
                    (tenant_id, programme_name, fee_type, amount, currency,
                     academic_year, metadata)
                values (%s, %s, 'tuition_annual', %s, 'INR', %s, %s)
                """,
                (
                    tenant_id, name, tuition_annual, ACADEMIC_YEAR,
                    json.dumps({"foreign_annual_usd": foreign_annual}),
                ),
            )
            cur.execute(
                """
                insert into programme_fees
                    (tenant_id, programme_name, fee_type, amount, currency,
                     academic_year, metadata)
                values (%s, %s, 'tuition_total', %s, 'INR', %s, %s)
                """,
                (
                    tenant_id, name, tuition_total, ACADEMIC_YEAR,
                    json.dumps({"foreign_total_usd": foreign_total}),
                ),
            )
            if hostel_double is not None:
                cur.execute(
                    """
                    insert into programme_fees
                        (tenant_id, programme_name, fee_type, amount, currency,
                         academic_year, metadata)
                    values (%s, %s, 'hostel_double_annual', %s, 'INR', %s, %s)
                    """,
                    (
                        tenant_id, name, hostel_double, ACADEMIC_YEAR,
                        json.dumps({"foreign_usd": hostel_double_usd}),
                    ),
                )
                cur.execute(
                    """
                    insert into programme_fees
                        (tenant_id, programme_name, fee_type, amount, currency,
                         academic_year, metadata)
                    values (%s, %s, 'hostel_triple_annual', %s, 'INR', %s, %s)
                    """,
                    (
                        tenant_id, name, hostel_triple, ACADEMIC_YEAR,
                        json.dumps({"foreign_usd": hostel_triple_usd}),
                    ),
                )

    print(f"seeded {len(ROWS)} programmes into programme_fees")


if __name__ == "__main__":
    seed()
