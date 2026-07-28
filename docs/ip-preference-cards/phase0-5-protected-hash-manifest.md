# Phase 0.5 protected-file hash manifest

Hashes in the “before” column were recorded before the catalog-role integrity work began.
Hashes in the “after” column were calculated after the complete validation sequence on
2026-07-28. All hashes are SHA-256.

## Protected sources and canonical outputs

| Protected target                                                                                  | Before                                                             | After                                                              | Result    |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------- |
| `Preference_card_module/IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx` | `fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf` | `fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf` | unchanged |
| `data/ip-preference-cards/generated/catalog-products.json`                                        | `1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe` | `1948f00c20f673dfbe2092bde6315c78ca02b8cb5f3f1e308e33c223175861fe` | unchanged |
| `data/ip-preference-cards/generated/product-roles.json`                                           | `df1f416cecc440ef165ad3f7ee52eff242a429fc816dad6f01ab61cd085fb8c8` | `df1f416cecc440ef165ad3f7ee52eff242a429fc816dad6f01ab61cd085fb8c8` | unchanged |
| `data/ip-preference-cards/generated/verification-backlog.json`                                    | `25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38` | `25ab658850a5df620986d4596d5043f40e46d17132493dd62d7adaffc36c1b38` | unchanged |
| `data/ip-preference-cards/generated/hospital-formulary-staging.json`                              | `f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73` | `f8ceb2433694f7ef1d5f65a6e4533fa6c2b1f83659d6ba017abda5fda4908e73` | unchanged |
| `data/ip-preference-cards/generated/slot-product-options.json`                                    | `73a08536f2c9a9dab9b92f554acb87c4bc7bd707b9d65eafa939d96835c44091` | `73a08536f2c9a9dab9b92f554acb87c4bc7bd707b9d65eafa939d96835c44091` | unchanged |
| `data/ip-preference-cards/generated/procedure-slots.json`                                         | `b7b85083951c1401b353e54f40b0f1b2d7166d60008ac77e2a3ea463b1209f73` | `b7b85083951c1401b353e54f40b0f1b2d7166d60008ac77e2a3ea463b1209f73` | unchanged |
| `data/ip-preference-cards/generated/roles.json`                                                   | `26b499846b59a2d067585e52251f99c7f133339bce8673f2713ac51deec786a4` | `26b499846b59a2d067585e52251f99c7f133339bce8673f2713ac51deec786a4` | unchanged |
| `data/ip-preference-cards/seed/openfda-calibration-cohort.json`                                   | `823969347c7cf85a1b13e10c76ebc9aad2cbcbfc1233b582c29d0670f73141d2` | `823969347c7cf85a1b13e10c76ebc9aad2cbcbfc1233b582c29d0670f73141d2` | unchanged |
| `docs/ip-preference-cards/openfda-live-calibration-report.md`                                     | `7c9a35944211351c63d4f95b28b3178059b4202f4ea545ed95f49982865abdea` | `7c9a35944211351c63d4f95b28b3178059b4202f4ea545ed95f49982865abdea` | unchanged |
| `scripts/ip-preference-cards/openfda/manufacturer-aliases.ts`                                     | `6dff7acd53a5825330bfcc984832a3071c369621a6b80a4b88d42f03d28da902` | `6dff7acd53a5825330bfcc984832a3071c369621a6b80a4b88d42f03d28da902` | unchanged |
| `src/features/preference-cards/server/manufacturer-aliases.ts`                                    | `aad9ff0026583744dc77c71f58395dd48167c04a9c358b7549aa67cd80bfeddd` | `aad9ff0026583744dc77c71f58395dd48167c04a9c358b7549aa67cd80bfeddd` | unchanged |
| `scripts/ip-preference-cards/openfda/classify-match.ts`                                           | `863c3bf58f2a7e2fd9ca8b616fcf4a25dcc8526bbf5899024970b3c95a69ff7a` | `863c3bf58f2a7e2fd9ca8b616fcf4a25dcc8526bbf5899024970b3c95a69ff7a` | unchanged |
| `scripts/ip-preference-cards/openfda/query-plan.ts`                                               | `7fe7af1615adc84ed39b2e12db042bdb3e63d61e01cf95ac808e69e6a6d71f84` | `7fe7af1615adc84ed39b2e12db042bdb3e63d61e01cf95ac808e69e6a6d71f84` | unchanged |

## OpenFDA generated artifacts

The manifest is the SHA-256 of the sorted 48-line `SHA-256 path` list. Its before and after
value is
`4cc03adac07ad4f7e2d455559377017af9f2c9048240e3637ced4d46e9add61c`.
The identical composite manifest proves that the path set and every path-level hash below
remained byte-identical. No live OpenFDA request or bulk UDI download was made.

| Artifact                                                                                           | SHA-256 before and after                                           | Result    |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------- |
| `data/ip-preference-cards/generated/openfda/calibration/audit.csv`                                 | `4614b3d4e67a510b73a1657b816f9ad2e3e8abe3cc5689e058f5df8c6c82de46` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/audit.md`                                  | `277c68899be116d2553d64f4ca2a655345f808c9a7b90d1872e264b76b24c284` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/cached/enrichment-proposals.json`          | `0184b231f1c268bc45e02e261f183462b9627a44431167265322230453fc9293` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/cached/high-confidence-candidates.csv`     | `62c1c7900f6c5878a925d397dcd1221b3d9632e3c4917fae69203d4589ae840a` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/cached/query-errors.csv`                   | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/cached/review-required.csv`                | `5e05acec8b31ac9aaaabbf5210be55a40d4165b623076ffeaba750697e9c685f` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/cached/run-summary.json`                   | `856f3f6ee60127c1364f4d44de7a18bda457b1d0f32c0733fd57e015a77d2e62` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/cached/unmatched-products.csv`             | `15bbe45e503ea5af7b4f2e4ea6e6b815cc56b21c338c7ec590a6c83c9e8ec6b4` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/final/enrichment-proposals.json`           | `0184b231f1c268bc45e02e261f183462b9627a44431167265322230453fc9293` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/final/high-confidence-candidates.csv`      | `62c1c7900f6c5878a925d397dcd1221b3d9632e3c4917fae69203d4589ae840a` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/final/query-errors.csv`                    | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/final/review-required.csv`                 | `5e05acec8b31ac9aaaabbf5210be55a40d4165b623076ffeaba750697e9c685f` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/final/run-summary.json`                    | `6fd412af77a11bd46d31ec820cb5fe2f75e0fa5949cd8a4a38f0b4f05cf5af65` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/final/unmatched-products.csv`              | `15bbe45e503ea5af7b4f2e4ea6e6b815cc56b21c338c7ec590a6c83c9e8ec6b4` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/initial/enrichment-proposals.json`         | `cde1d5a372e05a2b73b39b91177d3735416cbda77075d9f008c07a1b31f99f31` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/initial/high-confidence-candidates.csv`    | `daacc2a48f3a15f8bd666c016d1004496c139a8b8e8a89ebc61ba0f8f96be23b` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/initial/query-errors.csv`                  | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/initial/review-required.csv`               | `431bdf1aad0f1fc63e54c8fad2627273a3bbe5956ad2ce24cff45469b7c2ce58` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/initial/run-summary.json`                  | `c1d20f6be4de48a3e43902dce7adbfaa0d632bdaa5c45431198ea35bfdbbe5ae` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/initial/unmatched-products.csv`            | `9fc74129f8ca1f4c4e1109a0446470617884175cf48e87aa61cb84ebcb68931b` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/live/enrichment-proposals.json`            | `b9adc287ae7c573e49cb4c353099155f3b7a76ab6543b14b4e2d955c4c063377` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/live/high-confidence-candidates.csv`       | `62c1c7900f6c5878a925d397dcd1221b3d9632e3c4917fae69203d4589ae840a` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/live/query-errors.csv`                     | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/live/review-required.csv`                  | `73eb947c612a96f513a541b719cede7da22de49cf7fbad71253d799b1123592f` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/live/run-summary.json`                     | `d7c0e97b72ebb63d8f46ce54934f9f01fe8ca4057df9ab10786d48a00481fb5b` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/live/unmatched-products.csv`               | `9fc74129f8ca1f4c4e1109a0446470617884175cf48e87aa61cb84ebcb68931b` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/metrics.json`                              | `dd60c8228206920eba4b0b0c7254a34e23e47361d49412ac0ef72fd3407e3031` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/postfilter/enrichment-proposals.json`      | `eddecb337f36eacbbf4a4a2b4d302a0ae4062bd74fc5834ea2e19e38300d881c` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/postfilter/high-confidence-candidates.csv` | `62c1c7900f6c5878a925d397dcd1221b3d9632e3c4917fae69203d4589ae840a` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/postfilter/query-errors.csv`               | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/postfilter/review-required.csv`            | `5e05acec8b31ac9aaaabbf5210be55a40d4165b623076ffeaba750697e9c685f` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/postfilter/run-summary.json`               | `ce996797d70fdb6dcee25efb2ac62cee426553c064a375142b4bd5c28a7e0a44` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/postfilter/unmatched-products.csv`         | `15bbe45e503ea5af7b4f2e4ea6e6b815cc56b21c338c7ec590a6c83c9e8ec6b4` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/refresh/enrichment-proposals.json`         | `8a070fa9da8e0dc3e682cb0748c9ceb5fb96250bbf1057bf384a044bf85dc819` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/refresh/high-confidence-candidates.csv`    | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/refresh/query-errors.csv`                  | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/refresh/review-required.csv`               | `1159a06ef100cbab82a0ca1b64d74219107ca9520c276a810ae6fecb4081a6eb` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/refresh/run-summary.json`                  | `fbf250769e6101c4536d06a3b46846442c817ee8376991594eff2d5338a6d0bb` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/refresh/unmatched-products.csv`            | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/safety-verification.json`                  | `2cfdc66a78706a4ec9e334af83bac4e3e20aa5603867a3b9e57efa7a2767354c` | unchanged |
| `data/ip-preference-cards/generated/openfda/calibration/schema-audit.json`                         | `404dd358bfa8938c0043c2ee91981f84b9ee37b80e55d68606dc75ac73f78379` | unchanged |
| `data/ip-preference-cards/generated/openfda/enrichment-proposals.json`                             | `643efd5ed1d7b952ba351a7d8dca70e7634aef5e39cfb2415ba94aeba427586a` | unchanged |
| `data/ip-preference-cards/generated/openfda/high-confidence-candidates.csv`                        | `62c1c7900f6c5878a925d397dcd1221b3d9632e3c4917fae69203d4589ae840a` | unchanged |
| `data/ip-preference-cards/generated/openfda/manifest-snapshot.json`                                | `d9199fbe41fe36a8e89606cc63b43db7c65a08d3842d342034f39bccffe8ba4b` | unchanged |
| `data/ip-preference-cards/generated/openfda/query-errors.csv`                                      | `85a2cc03a13b4ae4ffb7178f31816b57c48a68801f56471bd7fee423819729d5` | unchanged |
| `data/ip-preference-cards/generated/openfda/review-required.csv`                                   | `5e05acec8b31ac9aaaabbf5210be55a40d4165b623076ffeaba750697e9c685f` | unchanged |
| `data/ip-preference-cards/generated/openfda/run-summary.json`                                      | `c5eec7d944f6fec6d6f470b9c2ac2599e6f2476b18d34d1ea0f8b0bea7be0fed` | unchanged |
| `data/ip-preference-cards/generated/openfda/unmatched-products.csv`                                | `15bbe45e503ea5af7b4f2e4ea6e6b815cc56b21c338c7ec590a6c83c9e8ec6b4` | unchanged |
