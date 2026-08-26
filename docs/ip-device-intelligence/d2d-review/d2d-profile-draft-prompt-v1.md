# D2D profile draft prompt v1

Create a neutral, concise product-profile proposal from only the ordered evidence packet supplied
for one catalog product.

Constraints:

- Write at most three summary claims, with one source-cited sentence per claim.
- Cite every claim and specification with a packet source ID and exact locator.
- Preserve whether each claim is exact-product, family, or configuration evidence.
- Do not convert family evidence into an exact-product claim.
- State only the device type, intended function, exact configuration, and explicitly documented
  specifications supported by the packet.
- Do not infer clinical compatibility, equivalence, substitution, superiority, preference,
  procurement suitability, formulary status, current availability, or orderability.
- Do not state or imply FDA clearance, approval, exemption, registration, listing, or distribution
  status. Those are reviewed independently.
- Do not paraphrase GUDID identity as authorization.
- Avoid promotional wording and unsupported clinical benefit claims.
- If evidence is insufficient, return an insufficient-evidence proposal rather than filling gaps
  from the product name or catalog number.
- Preserve the content locale. Do not silently translate.

The output is a draft only. It cannot become public content until an accountable physician-owner
records a final reviewed JSON decision.
