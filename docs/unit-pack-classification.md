# PlotScale unit pack classification

This report records the first-pass classification of the supplied legacy and
research material. Research rows are not runtime truth. Promotion is always
`research → suggested → verified`, and verified promotion requires owner
approval plus a signed catalog release.

## Verified at launch

| Pack | Contents | Reason |
| --- | --- | --- |
| `global_si_metric` | SI/metric length and land-area units | Exact international definitions |
| `global_international_imperial` | International inch/foot/yard/mile and square units/acre | Exact international-foot definitions |
| `global_international_survey` | Gunter chain/link, rod/pole/perch, furlong and explicit square forms | Exact derivation from the international foot |
| `us_legacy_survey` | U.S. survey foot and survey acre | Official historical variant; advanced-only |

## Suggested launch candidates

| Pack | Region/family | Confirmation required | Main unresolved point |
| --- | --- | --- | --- |
| `in_assam_bigha_katha_lessa` | Assam Bigha–Katha–Lessa | Ratios + one known area | Owner review |
| `in_west_bengal_bigha_katha_chatak` | West Bengal Bigha–Katha–Chatak | Ratios + one known area | Owner review/locality |
| `np_terai_bigha_kaththa_dhur` | Nepal Terai | Ratios + one known area | Supplied metric precision |
| `np_hills_ropani_aana_paisa_daam` | Nepal hills/mountains | Ratios + one known area | Supplied metric precision |
| `in_punjab_haryana_66in_karam_marla_kanal` | India Punjab/Haryana named 66-inch Karam system | Karam/ratios + one known area | Local non-invariance |
| `pk_punjab_karam_marla_kanal` | Pakistan Punjab named Karam system | Karam/ratios + one known area | Current local standard |
| `th_rai_ngan_tarang_wa` | Thailand Rai family | Ratios + one known area | Owner approval |
| `cn_mainland_market_mu` | Mainland China market Mu | Known Mu size | Named-system confirmation |
| `tw_mu_ping` | Taiwan Mu–Ping | Ratio + one known area | Primary-source confirmation |
| `gr_modern_stremma` | Modern Greek Stremma | Known size | Exclude historical meanings |
| `no_modern_maal` | Modern Norwegian Mål | Known size | Exclude old Mål |
| `pk_jareeb_22yd_length_484sqyd_area` | Pakistan 22-yard Jareeb | Tool/area sense + known value | Current-use confirmation |

## Research-only groups

| Catalog pack | Included supplied research | Blocking reason |
| --- | --- | --- |
| `south_asia_unresolved` | Generic Bigha/Katha/Biswa/Dhur, UP/Bihar Laggi presets, generic Guz/Jareeb, unverified Kanal/Marla | Locality, dimension and hierarchy ambiguity |
| `latin_america_variable` | Manzana, Tarea, Caballería, Cuerda variants | Country/locality conflict and ranges |
| `historical_and_nongeometric` | Arpent, Morgen, Dunam, historical Mu/Pyeong, Scandinavian seed/value systems and ancient measures | Period ambiguity or no geometric sqm conversion |

## Quarantined supplied records

- The legacy Assam preset is blocked because it treats a 144 sq ft Lessa-sized
  record as Dhur and applies a conflicting `20 × 5` hierarchy.
- Generic Jareeb is blocked because the name may mean a length tool, a geometric
  area, a square of a named tool, or a non-geometric assessment.
- All district-level UP/Bihar Laggi presets remain research-only until the
  locality, tool definition and family ratios are owner-reviewed.
- Historical values from UN-era handbooks or secondary websites retain their
  source date and cannot establish present legal use by themselves.

## Source inventory covered

- `PlotScale_Units_Audit.xlsx`: legacy fixed units, duplicates, precision
  conflicts and Laggi forward/reverse formulas.
- `PlotScale_Units_Family_Structure_Review.xlsx`: family classifications,
  measuring tools, ratios and mixed-output candidates.
- `PlotScale_Global_Units_Research.xlsx`: 143 researched rows, Sizes.com
  extracts, regional conflicts and owner-review backlog.
- `Worldwide_Land_Measurement_Database.xlsx`: 1,367 concepts, conversion graph,
  source/QA methodology and ambiguity test vectors.
- `land_unit_presets.json/.xlsx`: proposed local presets; all treated as
  research unless represented by a separately reviewed pack.
- `Sizes_Units_A_to_Z_Length_Area.md`: discovery catalog only.
- Legacy PlotScale `land_units_master.json` and unit utilities: mathematical
  audit source only; their runtime architecture and UI are not reused.

