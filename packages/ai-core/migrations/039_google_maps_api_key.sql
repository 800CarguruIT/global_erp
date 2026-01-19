-- Store per-company Google Maps API key for map embed/search.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS google_maps_api_key text;
