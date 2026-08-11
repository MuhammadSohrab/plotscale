import { useState, useEffect, useMemo } from 'react';
import { Globe, MapPin, Star } from 'lucide-react';
import { BUILTIN_AREA_UNITS, mergeUnits, sortUnits, sqmToUnit, formatValue } from '../../lib/unitConversion';

const COUNTRY_NAMES = {
  IN: 'India', NP: 'Nepal', BD: 'Bangladesh', PK: 'Pakistan',
  TH: 'Thailand', JP: 'Japan', TW: 'Taiwan', KR: 'Korea',
  US: 'USA', GB: 'UK', AU: 'Australia', EG: 'Egypt',
  GLOBAL: 'Global / International',
};

function getFavorites() {
  try { return JSON.parse(localStorage.getItem('plotscale_fav_units') || '[]'); } catch { return []; }
}
function setFavorites(favs) {
  localStorage.setItem('plotscale_fav_units', JSON.stringify(favs));
}

export default function AreaConversionList({ areaSqm, primaryUnitId }) {
  const [userRegion, setUserRegion] = useState({ country: '', state: '', district: '' });
  const [favorites, setFavoritesState] = useState(getFavorites);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('plotscale_settings') || localStorage.getItem('plotscale_region') || '{}');
      setUserRegion({ country: cached.country || '', state: cached.state || '', district: cached.district || '' });
    } catch {}
  }, []);

  const toggleFav = (unitId) => {
    const current = getFavorites();
    const updated = current.includes(unitId)
      ? current.filter(f => f !== unitId)
      : [...current, unitId];
    setFavorites(updated);
    setFavoritesState(updated);
  };

  const allAreaUnits = useMemo(() => sortUnits(mergeUnits([], BUILTIN_AREA_UNITS)), []);

  const conversions = useMemo(() => {
    if (!areaSqm || areaSqm <= 0) return [];
    return allAreaUnits
      .filter(u => u.unit_id !== primaryUnitId)
      .map(u => ({ ...u, converted: sqmToUnit(areaSqm, u) }))
      .filter(u => u.converted > 0 && isFinite(u.converted));
  }, [areaSqm, allAreaUnits, primaryUnitId]);

  const grouped = useMemo(() => {
    const getP = (u) => {
      if (favorites.includes(u.unit_id)) return -1;
      const isGlobal = !u.country_code || u.country_code === 'GLOBAL';
      const isUC = userRegion.country && u.country_code === userRegion.country;
      const isUS = isUC && userRegion.state && u.admin1 === userRegion.state;
      const isUD = isUS && userRegion.district && u.district === userRegion.district;
      if (isUD) return 0; if (isUS) return 1; if (isUC) return 2; if (isGlobal) return 3; return 4;
    };
    const sorted = [...conversions].sort((a, b) => {
      const pa = getP(a), pb = getP(b);
      if (pa !== pb) return pa - pb;
      const ca = COUNTRY_NAMES[a.country_code || 'GLOBAL'] || a.country_code || '';
      const cb = COUNTRY_NAMES[b.country_code || 'GLOBAL'] || b.country_code || '';
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.admin1 || '').localeCompare(b.admin1 || '');
    });

    const favUnits = sorted.filter(u => favorites.includes(u.unit_id));
    const rest = sorted.filter(u => !favorites.includes(u.unit_id));

    const countries = [];
    rest.forEach(u => {
      const cKey = u.country_code || 'GLOBAL';
      const p = getP(u);
      let displayName = COUNTRY_NAMES[cKey] || cKey;
      if (userRegion.country && cKey === userRegion.country && p <= 2) displayName = `📍 ${displayName} (Your Region)`;
      else if (cKey === 'GLOBAL') displayName = '🌐 Global / International';

      let country = countries.find(c => c.key === cKey);
      if (!country) { country = { key: cKey, name: displayName, regions: [] }; countries.push(country); }
      const rLabel = [u.admin1, u.district].filter(Boolean).join(' · ');
      let region = country.regions.find(r => r.label === rLabel);
      if (!region) { region = { label: rLabel, units: [] }; country.regions.push(region); }
      region.units.push(u);
    });

    return { favUnits, countries };
  }, [conversions, userRegion, favorites]);

  if (!areaSqm || areaSqm <= 0) return null;

  const UnitCard = ({ u }) => (
    <div key={u.unit_id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 gap-1">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{u.unit_name}</p>
        <p className="text-xs text-slate-500">{u.unit_symbol}</p>
      </div>
      <p className="text-sm font-black text-blue-600 shrink-0 mx-1">{formatValue(u.converted)}</p>
      <button
        onClick={() => toggleFav(u.unit_id)}
        className="shrink-0 p-1 rounded-lg hover:bg-slate-200 transition-colors"
        title={favorites.includes(u.unit_id) ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={`w-3.5 h-3.5 ${favorites.includes(u.unit_id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-slate-900">All Unit Conversions</h3>

      {grouped.favUnits.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <p className="text-xs font-black uppercase tracking-wide text-amber-500">Favorites</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {grouped.favUnits.map(u => <UnitCard key={u.unit_id} u={u} />)}
          </div>
        </div>
      )}

      {grouped.countries.map(country => (
        <div key={country.key} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs font-black uppercase tracking-wide text-blue-600">{country.name}</p>
          </div>
          {country.regions.map(region => (
            <div key={region.label || 'general'}>
              {region.label && (
                <div className="flex items-center gap-1 pl-1 mb-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <p className="text-xs font-semibold text-slate-500">{region.label}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {region.units.map(u => <UnitCard key={u.unit_id} u={u} />)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
