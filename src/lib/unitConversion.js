/**
 * Unit Conversion Library
 * Base units: meter (length), sqm (area)
 * All conversions use factor_to_base.
 */

export const JAREEB_TYPES = [
  { id: 'GUNTER',       short: "Gunter's",      name: "Jareeb (Gunter's)",       native: "Gunter's Chain",       length_m: 20.1168, length_ft: 66,  links: 100, region: 'British/Global' },
  { id: 'SHAHJAHANI',   short: 'Shahjahani',    name: 'Jareeb (Shahjahani)',     native: 'शाहजहानी जरीब',         length_m: 50.292,  length_ft: 165, links: 100, region: 'Mughal/UP' },
  { id: 'REVENUE',      short: 'Revenue',       name: 'Jareeb (Revenue)',        native: 'राजस्व जरीब',           length_m: 10.0584, length_ft: 33,  links: 16,  region: 'British India Revenue' },
  { id: 'FAROOKHABADI', short: 'Farookhabadi',  name: 'Jareeb (Farookhabadi)',   native: 'फर्रुखाबादी जरीब',       length_m: 40.2336, length_ft: 132, links: 100, region: 'UP/Farookhabad' },
  { id: 'SAHARANPURI',  short: 'Saharanpuri',   name: 'Jareeb (Saharanpuri)',   native: 'सहारनपुरी जरीब',         length_m: 40.2336, length_ft: 132, links: 100, region: 'UP/Saharanpur' },
  { id: 'FATEHPURI',    short: 'Fatehpuri',     name: 'Jareeb (Fatehpuri)',     native: 'फतेहपुरी जरीब',          length_m: 40.2336, length_ft: 132, links: 100, region: 'UP/Fatehpur' },
  { id: 'METRIC',       short: 'Metric',        name: 'Jareeb (Metric)',         native: 'मेट्रिक जरीब',           length_m: 20.0,    length_ft: 65.6168, links: 100, region: 'Modern/Global' },
];

const JAREEB_LENGTH_UNITS = JAREEB_TYPES.flatMap(jt => {
  const linkM = jt.length_m / jt.links;
  return [
    { unit_id: `CHAIN_${jt.id}`, unit_name: jt.name,                  unit_symbol: `${jt.id.toLowerCase()}-ch`,   factor_to_base: jt.length_m, unit_type: 'length', scope_level: 'global', country_code: 'IN', variant_label: jt.native, region_label: jt.region },
    { unit_id: `KADI_${jt.id}`,  unit_name: `Kadi (${jt.short})`,     unit_symbol: `${jt.id.toLowerCase()}-link`, factor_to_base: linkM,        unit_type: 'length', scope_level: 'global', country_code: 'IN', variant_label: jt.native, region_label: jt.region },
  ];
});

const JAREEB_AREA_UNITS = JAREEB_TYPES.flatMap(jt => {
  const linkM = jt.length_m / jt.links;
  return [
    { unit_id: `SQ_CHAIN_${jt.id}`, unit_name: `Sq ${jt.name}`,          unit_symbol: `${jt.id.toLowerCase()}-ch²`,   factor_to_base: jt.length_m * jt.length_m, unit_type: 'area', scope_level: 'global', country_code: 'IN', variant_label: jt.native, region_label: jt.region },
    { unit_id: `SQ_KADI_${jt.id}`,  unit_name: `Sq Kadi (${jt.short})`, unit_symbol: `${jt.id.toLowerCase()}-link²`, factor_to_base: linkM * linkM,             unit_type: 'area', scope_level: 'global', country_code: 'IN', variant_label: jt.native, region_label: jt.region },
  ];
});

export const BUILTIN_LENGTH_UNITS = [
  { unit_id: 'METER',      unit_name: 'Meter',      unit_symbol: 'm',    factor_to_base: 1,          unit_type: 'length', scope_level: 'global' },
  { unit_id: 'FOOT',       unit_name: 'Foot',        unit_symbol: 'ft',   factor_to_base: 0.3048,     unit_type: 'length', scope_level: 'global' },
  { unit_id: 'YARD',       unit_name: 'Yard',        unit_symbol: 'yd',   factor_to_base: 0.9144,     unit_type: 'length', scope_level: 'global' },
  { unit_id: 'INCH',       unit_name: 'Inch',        unit_symbol: 'in',   factor_to_base: 0.0254,     unit_type: 'length', scope_level: 'global' },
  { unit_id: 'GAZ',        unit_name: 'Gaz',         unit_symbol: 'gaz',  factor_to_base: 0.9144,     unit_type: 'length', scope_level: 'national', country_code: 'IN' },
  { unit_id: 'CHAIN',      unit_name: 'Chain',       unit_symbol: 'ch',   factor_to_base: 20.1168,    unit_type: 'length', scope_level: 'global' },
  { unit_id: 'KILOMETER',  unit_name: 'Kilometer',   unit_symbol: 'km',   factor_to_base: 1000,       unit_type: 'length', scope_level: 'global' },
  { unit_id: 'MILE',       unit_name: 'Mile',        unit_symbol: 'mi',   factor_to_base: 1609.344,   unit_type: 'length', scope_level: 'global' },
  ...JAREEB_LENGTH_UNITS,
];

export const BUILTIN_AREA_UNITS = [
  { unit_id: 'SQM',        unit_name: 'Square Meter',   unit_symbol: 'm²',    factor_to_base: 1,           unit_type: 'area', scope_level: 'global' },
  { unit_id: 'SQFT',       unit_name: 'Square Foot',    unit_symbol: 'ft²',   factor_to_base: 0.092903,    unit_type: 'area', scope_level: 'global' },
  { unit_id: 'SQYD',       unit_name: 'Square Yard',    unit_symbol: 'yd²',   factor_to_base: 0.836127,    unit_type: 'area', scope_level: 'global' },
  { unit_id: 'ACRE',       unit_name: 'Acre',           unit_symbol: 'ac',    factor_to_base: 4046.856,    unit_type: 'area', scope_level: 'global' },
  { unit_id: 'HECTARE',    unit_name: 'Hectare',        unit_symbol: 'ha',    factor_to_base: 10000,       unit_type: 'area', scope_level: 'global' },
  { unit_id: 'ARE',        unit_name: 'Are',            unit_symbol: 'a',     factor_to_base: 100,         unit_type: 'area', scope_level: 'global' },
  { unit_id: 'SQKM',       unit_name: 'Square Kilometer', unit_symbol: 'km²', factor_to_base: 1000000,     unit_type: 'area', scope_level: 'global' },
  { unit_id: 'SQIN',       unit_name: 'Square Inch',   unit_symbol: 'in²',   factor_to_base: 0.00064516,  unit_type: 'area', scope_level: 'global' },
  ...JAREEB_AREA_UNITS,
];

export function lengthToMeters(value, unit) {
  if (!unit || !unit.factor_to_base) return value;
  return value * unit.factor_to_base;
}

export function sqmToUnit(sqm, unit) {
  if (!unit || !unit.factor_to_base) return sqm;
  return sqm / unit.factor_to_base;
}

export function unitToSqm(value, unit) {
  if (!unit || !unit.factor_to_base) return value;
  return value * unit.factor_to_base;
}

export function convertAreaUnit(value, fromUnit, toUnit) {
  const sqm = unitToSqm(value, fromUnit);
  return sqmToUnit(sqm, toUnit);
}

export function formatValue(value, precision = 4) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  if (value === 0) return '0';
  if (value >= 1000) return Number(value.toFixed(2)).toLocaleString('en-IN');
  if (value >= 1) return Number(value.toFixed(precision)).toString();
  return Number(value.toFixed(6)).toString();
}

export function findUnit(units, unitId) {
  return units.find(u => u.unit_id === unitId || u.id === unitId);
}

export function mergeUnits(dbUnits = [], builtins = []) {
  const dbIds = new Set(dbUnits.map(u => u.unit_id));
  const extras = builtins.filter(b => !dbIds.has(b.unit_id));
  return [...dbUnits, ...extras];
}

export const UNIT_CATEGORY_ORDER = ['Common', 'Jareeb', 'Kadi', 'Sq Jareeb', 'Sq Kadi', 'Combos', 'Other'];

export function getUnitCategory(u) {
  if (u.category) {
    const map = { common: 'Common', jareeb: 'Jareeb', kadi: 'Kadi', combo: 'Combos', other: 'Other' };
    return map[u.category] || 'Other';
  }
  const name = (u.unit_name || u.label || '').toLowerCase();
  if (name.startsWith('sq jareeb')) return 'Sq Jareeb';
  if (name.startsWith('sq kadi')) return 'Sq Kadi';
  if (name.startsWith('jareeb')) return 'Jareeb';
  if (name.startsWith('kadi')) return 'Kadi';
  return 'Other';
}

export function sortUnits(units = []) {
  return [...units].sort((a, b) => {
    const ca = getUnitCategory(a), cb = getUnitCategory(b);
    const pa = UNIT_CATEGORY_ORDER.indexOf(ca);
    const pb = UNIT_CATEGORY_ORDER.indexOf(cb);
    if (pa !== pb) return pa - pb;
    return (a.unit_name || a.label || '').localeCompare(b.unit_name || b.label || '');
  });
}

export function groupUnitsByCountry(units = []) {
  const groups = {};
  units.forEach(u => {
    const key = u.country_code || 'GLOBAL';
    if (!groups[key]) groups[key] = [];
    groups[key].push(u);
  });
  return groups;
}
