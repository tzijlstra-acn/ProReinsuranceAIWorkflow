# Terminology Decisions

This document records decisions that are still open or provisional,
so they can be resolved centrally and propagated consistently.

---

## Open: MAYA / MITRA assignment confirmation

**Status:** Provisional — pending Munich Re confirmation

**Current assignment:**
- **MITRA** = Compliance Hub — regulatory analysis and policy/control gap analysis
- **MAYA** = Product Hub — work-product analysis, documentation updates, migration support, proposed product remediation

**Where each name appears in the codebase:**

| Location | Name used | Correct per current assignment |
|---|---|---|
| `lib/terminology.ts` | MITRA, MAYA | Yes |
| `app/compliance-hub/regulatory-intelligence/page.tsx` | MITRA (proposed) | Yes |
| `app/api/product-hub/products/[id]/maya/route.ts` | MAYA (route name) | Yes |
| `app/api/product-hub/products/[id]/mitra/route.ts` | MITRA (route name) | **No** — this route performs product-level compliance gap analysis, which is a Product Hub action. The route name uses MITRA but the function belongs to MAYA's scope. |
| `app/product-hub/page.tsx` | MITRA button label | **No** — the Product Hub inbox shows a "MITRA" button for gap analysis. This should be "MAYA" per the current assignment. |

**Discrepancy note:**
The Product Hub inbox originally showed a "MITRA" button for gap analysis.
This has been corrected: the button now reads "MAYA (Assess)" per the approved terminology.
The internal route at `/api/product-hub/products/[id]/mitra` retains its filename for backward-compatibility;
only the UI label was corrected.

**Partial resolution:**
- UI label corrected in `app/product-hub/page.tsx` ✅
- Route file name (`mitra`) not yet renamed — low priority, internal only

**Still open:**
1. Munich Re to confirm MAYA/MITRA assignment.
2. Once confirmed, optionally rename the API route from `mitra` to `maya-assess` for full consistency.
3. Update this document to mark fully resolved.

---

## Resolved: DDCR placement in the business flow

**Status:** Resolved

**Decision:** DDCR is placed at the end of the verified business journey.
It may only show a requirement as Compliant after all mandatory verification
checks have passed and the evidence package is complete.

---

## Resolved: "Essentials" as the product compliance framework name

**Status:** Resolved

**Decision:** The product compliance framework is referred to as "Essentials"
throughout the UI and documentation.
