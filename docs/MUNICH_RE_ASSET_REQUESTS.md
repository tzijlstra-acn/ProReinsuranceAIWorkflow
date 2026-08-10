# Munich Re Asset Requests

This document lists the exact recordings needed to replace the placeholders
in Step 1 of the board demo. Each asset maps to a slot in `data/client-assets.ts`.

---

## How to insert a real asset

1. Place the recording file in the `public/` directory (e.g. `public/assets/regulatory-review.mp4`).
2. Open `data/client-assets.ts`.
3. Find the relevant entry by its `id`.
4. Set `videoUrl: '/assets/regulatory-review.mp4'`.
5. The placeholder card automatically switches to a `<video>` element.

---

## Asset Requests

### ASSET_REGULATORY_REVIEW
**Label:** Regulatory or policy review  
**Used in:** Step 1 — Activity 1 (Review the Change)  
**Expected content:**
Screen recording showing how Munich Re teams currently receive and review an
incoming regulatory or policy change. Should show the intake process, the
initial review, and the relationship check against internal guidelines or standards.  
**Recommended duration:** 60–90 seconds  
**Notes:** Do not script a fictional EU law. Use a real or representative internal review.

---

### ASSET_PRODUCT_HUB_COCKPIT
**Label:** Product Hub product cockpit  
**Used in:** Step 1 — Activity 2 (Manage Product & Work Products)  
**Expected content:**
Screen recording of the current Product Hub or equivalent tool showing a product
or application overview — the screen a Product Owner would open to see their
compliance obligations.  
**Recommended duration:** 30–60 seconds  
**Notes:** A real product (anonymised if needed) is preferred over a demo screen.

---

### ASSET_ESSENTIALS_APPLICABILITY
**Label:** Essentials / applicability criteria  
**Used in:** Step 1 — Activity 2 (Manage Product & Work Products)  
**Expected content:**
Recording showing how the Essentials framework (or the current equivalent) is
used to determine which regulatory requirements apply to a product.
Should show the applicability assessment process.  
**Recommended duration:** 45–75 seconds

---

### ASSET_WORK_PRODUCTS
**Label:** Required work products  
**Used in:** Step 1 — Activity 2 (Manage Product & Work Products)  
**Expected content:**
Recording showing the list of required work products (SDDs, Operating Manuals,
evidence artefacts, etc.) for a product in the current compliance framework.  
**Recommended duration:** 30–45 seconds

---

### ASSET_SDD_OR_OM
**Label:** SDD or Operating Manual  
**Used in:** Step 1 — Activity 2 (Manage Product & Work Products)  
**Expected content:**
Recording of a real SDD or Operating Manual being opened and navigated.
Should show a representative section — not a blank template.  
**Recommended duration:** 45–60 seconds  
**Notes:** Sensitive content may be blurred.

---

### ASSET_TASK_COMMENT
**Label:** Existing task / comment mechanism  
**Used in:** Step 1 — Activity 2 (Manage Product & Work Products)  
**Expected content:**
Recording of the current task or comment mechanism used by Product Teams for
compliance actions. Could be Jira, ServiceNow, an email thread, or an internal
tracking tool.  
**Recommended duration:** 30–45 seconds

---

### ASSET_DOC_UPDATE_MIGRATION
**Label:** Document update or migration capability  
**Used in:** Step 1 — Activity 2 (Manage Product & Work Products)  
**Expected content:**
Recording of the current process for updating a document during a compliance
change. Should show the before/after edit — the document open, a change made,
and a save or version increment.  
**Recommended duration:** 60–90 seconds

---

### ASSET_VERIFICATION_RESULT
**Label:** Technical verification result  
**Used in:** Step 1 — Activity 3 (Report Current Status) / supplemental  
**Expected content:**
Recording of a technical verification or policy-check result as it appears
today — e.g. an Azure Policy compliance report, a test-run result, or a
manual sign-off confirmation.  
**Recommended duration:** 30–45 seconds

---

### ASSET_DDCR_REPORTING
**Label:** Current DDCR reporting view  
**Used in:** Step 1 — Activity 3 (Report Current Status)  
**Expected content:**
Recording of the current DDCR reporting view showing a product or requirement's
compliance or fulfilment status. Should be the real tool the compliance team
currently uses to report status to stakeholders.  
**Recommended duration:** 45–60 seconds  
**Notes:** This is the "current state" view — it will be contrasted with the
automated, connected DDCR shown in Step 2.
