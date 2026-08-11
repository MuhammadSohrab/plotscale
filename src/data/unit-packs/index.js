import globalSiManifest from "./verified_unit_packs/global_si_metric/manifest.json";
import globalSiData from "./verified_unit_packs/global_si_metric/data.json";
import imperialManifest from "./verified_unit_packs/global_international_imperial/manifest.json";
import imperialData from "./verified_unit_packs/global_international_imperial/data.json";
import surveyManifest from "./verified_unit_packs/global_international_survey/manifest.json";
import surveyData from "./verified_unit_packs/global_international_survey/data.json";
import usLegacyManifest from "./verified_unit_packs/us_legacy_survey/manifest.json";
import usLegacyData from "./verified_unit_packs/us_legacy_survey/data.json";

import assamManifest from "./suggested_unit_packs/in_assam_bigha_katha_lessa/manifest.json";
import assamData from "./suggested_unit_packs/in_assam_bigha_katha_lessa/data.json";
import westBengalManifest from "./suggested_unit_packs/in_west_bengal_bigha_katha_chatak/manifest.json";
import westBengalData from "./suggested_unit_packs/in_west_bengal_bigha_katha_chatak/data.json";
import nepalTeraiManifest from "./suggested_unit_packs/np_terai_bigha_kaththa_dhur/manifest.json";
import nepalTeraiData from "./suggested_unit_packs/np_terai_bigha_kaththa_dhur/data.json";
import nepalHillsManifest from "./suggested_unit_packs/np_hills_ropani_aana_paisa_daam/manifest.json";
import nepalHillsData from "./suggested_unit_packs/np_hills_ropani_aana_paisa_daam/data.json";
import indiaPunjabManifest from "./suggested_unit_packs/in_punjab_haryana_66in_karam_marla_kanal/manifest.json";
import indiaPunjabData from "./suggested_unit_packs/in_punjab_haryana_66in_karam_marla_kanal/data.json";
import pakistanPunjabManifest from "./suggested_unit_packs/pk_punjab_karam_marla_kanal/manifest.json";
import pakistanPunjabData from "./suggested_unit_packs/pk_punjab_karam_marla_kanal/data.json";
import thailandManifest from "./suggested_unit_packs/th_rai_ngan_tarang_wa/manifest.json";
import thailandData from "./suggested_unit_packs/th_rai_ngan_tarang_wa/data.json";
import chinaMuManifest from "./suggested_unit_packs/cn_mainland_market_mu/manifest.json";
import chinaMuData from "./suggested_unit_packs/cn_mainland_market_mu/data.json";
import taiwanManifest from "./suggested_unit_packs/tw_mu_ping/manifest.json";
import taiwanData from "./suggested_unit_packs/tw_mu_ping/data.json";
import greeceManifest from "./suggested_unit_packs/gr_modern_stremma/manifest.json";
import greeceData from "./suggested_unit_packs/gr_modern_stremma/data.json";
import norwayManifest from "./suggested_unit_packs/no_modern_maal/manifest.json";
import norwayData from "./suggested_unit_packs/no_modern_maal/data.json";
import jareebManifest from "./suggested_unit_packs/pk_jareeb_22yd_length_484sqyd_area/manifest.json";
import jareebData from "./suggested_unit_packs/pk_jareeb_22yd_length_484sqyd_area/data.json";

import southAsiaResearchManifest from "./research_catalog/south_asia_unresolved/manifest.json";
import southAsiaResearchData from "./research_catalog/south_asia_unresolved/data.json";
import latinResearchManifest from "./research_catalog/latin_america_variable/manifest.json";
import latinResearchData from "./research_catalog/latin_america_variable/data.json";
import historicalResearchManifest from "./research_catalog/historical_and_nongeometric/manifest.json";
import historicalResearchData from "./research_catalog/historical_and_nongeometric/data.json";

const pack = (manifest, data) => Object.freeze({ manifest, data });

export const VERIFIED_UNIT_PACKS = Object.freeze([
  pack(globalSiManifest, globalSiData),
  pack(imperialManifest, imperialData),
  pack(surveyManifest, surveyData),
  pack(usLegacyManifest, usLegacyData),
]);

export const SUGGESTED_UNIT_PACKS = Object.freeze([
  pack(assamManifest, assamData),
  pack(westBengalManifest, westBengalData),
  pack(nepalTeraiManifest, nepalTeraiData),
  pack(nepalHillsManifest, nepalHillsData),
  pack(indiaPunjabManifest, indiaPunjabData),
  pack(pakistanPunjabManifest, pakistanPunjabData),
  pack(thailandManifest, thailandData),
  pack(chinaMuManifest, chinaMuData),
  pack(taiwanManifest, taiwanData),
  pack(greeceManifest, greeceData),
  pack(norwayManifest, norwayData),
  pack(jareebManifest, jareebData),
]);

export const RESEARCH_UNIT_PACKS = Object.freeze([
  pack(southAsiaResearchManifest, southAsiaResearchData),
  pack(latinResearchManifest, latinResearchData),
  pack(historicalResearchManifest, historicalResearchData),
]);

export const BUNDLED_UNIT_PACKS = Object.freeze([
  ...VERIFIED_UNIT_PACKS,
  ...SUGGESTED_UNIT_PACKS,
  ...RESEARCH_UNIT_PACKS,
]);

