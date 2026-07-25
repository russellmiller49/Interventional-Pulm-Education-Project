# v0.4 Changelog

- Added explicit `global_part_number` and `reference_part_number` fields to product records.
- Mapped **35** existing Cook `G`-prefixed identifiers into `global_part_number`.
- Populated **12** separately published Cook reference part numbers from the uploaded blocker and EBUS needle catalogs.
- Added both identifiers to the workbook Products and Hospital_Formulary sheets.
- Updated `products.csv`, `catalog_bundle.json`, `schema.sql`, `web_app_model.csv`, and package documentation.
- Preserved `catalog_number`, `alternate_ids`, verification status, source provenance, and dropdown visibility without reclassifying product readiness.
