# Interventional Pulmonology Procedure Equipment Catalog — v0.4

Generated: 2026-07-24

## Contents

- **1,108** product/configuration records
- **431** prototype-visible source-backed records
- **23** manufacturers/distributors
- **96** normalized equipment/disposable roles
- **13** procedure templates
- **174** generic procedure slots
- **1,667** slot-to-product options
- **30** source documents
- **1,239** product-to-source citations
- **78** compatibility rules
- **1,134** open verification/QA tasks
- **35** populated global part numbers
- **12** populated reference part numbers

## v0.4 identifier update

The product data model now stores three distinct manufacturer identifiers:

- `catalog_number`: the general published catalog, order, model, or SKU identifier already used by the catalog.
- `global_part_number`: the manufacturer's explicit global part number when available. Existing Cook `G`-prefixed identifiers are mapped here.
- `reference_part_number`: a separately published manufacturer reference number. This is populated only when the source provides a distinct value.

The same fields are included in the **Products** and **Hospital_Formulary** workbook sheets, `products.csv`, `catalog_bundle.json`, and the PostgreSQL/Supabase starter schema.

The update preserves the existing verification and visibility controls. An identifier value does not establish current U.S. labeling, commercial availability, compatibility, or hospital formulary status.

## Publication controls

A product's role fit does not prove full compatibility. The website should:

1. Restrict default dropdowns to `live_dropdown_status = Prototype visible - reverify before production`.
2. Apply exact compatibility rules for channel diameter, scope hub, barrel ID, guidewire, cable/generator, trocar, stent applicator, and catheter system.
3. Further restrict selections to the hospital formulary.
4. Require current IFU, FDA/UDI, commercial availability, recall, and local approval verification before production use.
5. Preserve source, verifier, and dated change history for every production-visible SKU.

## Important

This package supports equipment and disposable inventory/setup-card generation. It is not a clinical checklist, order set, or substitute for current device labeling, institutional policy, credentialing, or clinical judgment.
