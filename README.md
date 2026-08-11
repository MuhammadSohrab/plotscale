# PlotScale

PlotScale currently includes authentication/hybrid storage, the central unit
foundation, land-area calculators, Google Map measurement, local plot storage,
GeoJSON/KML exchange, and a browser-generated PDF report.

The Area Calculator first opens a four-card plot-type chooser:

- Triangle Plot (one or multiple Heron triangles)
- Irregular Plot (four sides, with an optional Corner 1 to Corner 3 diagonal)
- Regular Shapes (square, rectangle, pentagon, and hexagon)
- Custom Shapes (five to ten sides with optional fan diagonals)

Map Measurement remains a separate Dashboard tool and uses geodesic measurement
on Google Maps.

Image Trace is deliberately not implemented in this codebase. It will be
integrated later from the separate web-only Image Trace application.

## Protected design references

- [Typography and PlotScale brand specification](docs/TYPOGRAPHY_SPEC.md)

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Guest Mode and IndexedDB work without environment values. For account features:

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
4. Enable the desired OAuth providers in Supabase Auth. The implemented provider
   buttons are Google, Apple, and Facebook.
5. Add local and production redirect URLs to the Supabase Auth allow list.

For Map Mode, set `VITE_GOOGLE_MAPS_API_KEY` and optionally
`VITE_GOOGLE_MAPS_MAP_ID`. Restrict the browser-visible key by production HTTP
referrer, enabled API, and quota. The key must support Maps JavaScript,
Places/Geocoding, Elevation, and Static Maps when satellite imagery is required
in PDF reports.

Never put the Supabase service-role key in this frontend.

## Storage boundary

- **Supabase:** user profile, app settings, subscription/credit metadata, and
  calibrated unit profiles. Row-level security restricts all rows to `auth.uid()`.
- **IndexedDB (Dexie):** saved plots, measurements, boundary details, snapshots,
  generated-file references, unit registries, preferences, custom units, and
  calibrated local profiles. Plot deletion removes all related heavy records in
  one transaction.

The local database is authoritative for heavy plot data. Cloud services never
receive plots or media.

## Measurement and reports

- All manual measurements normalize to metres and square metres before display.
- A four-side result without a diagonal is explicitly marked as a maximum-area
  cyclic estimate.
- Custom shapes become confirmed only when the complete Corner 1 fan-diagonal
  set is supplied.
- Map Mode uses Google spherical geometry for distances and area, keeps a
  precision magnifier at the provider's maximum available satellite zoom, and
  allows extra digital magnification for point placement.
- PDF reports are generated on-device with the original PlotScale logo. Map
  reports contain a locally generated QR that opens driving directions to the
  selected entrance point, or to the plot centre as a fallback.

## Unit engine

- Length values normalize to meters; area values normalize to square meters.
- Fixed unit factors use exact definitions where available.
- Bigha, Katha, and Dhur remain factorless until a local profile is calibrated.
- A Laggi calibration derives Dhur from the square of its meter length, then
  resolves Katha and Bigha through the saved hierarchy multipliers.
- Composite output supports Acre/Dismil, Acre/Sq Yard/Sq Ft, and calibrated
  Bigha/Katha/Dhur families.
# Supabase migrations

For new and existing cloud environments, apply the numbered files in
`supabase/migrations` in filename order. `supabase/schema.sql` is retained only
as the original Part 1 baseline; entitlement enforcement, append-only profile
revisions, evidence privacy and later Unit Engine changes live in migrations
and must not be replaced by client-side checks.
