-- 027_translations.sql
-- Global translation cache for UI strings

CREATE TABLE IF NOT EXISTS ui_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text text NOT NULL,
  target_lang text NOT NULL,
  translated_text text NOT NULL,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_text, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_ui_translations_lang
  ON ui_translations (target_lang);

-- Touch trigger for updated_at if you later update rows
CREATE OR REPLACE FUNCTION touch_ui_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_ui_translations_updated_at ON ui_translations;
CREATE TRIGGER trg_touch_ui_translations_updated_at
BEFORE UPDATE ON ui_translations
FOR EACH ROW
EXECUTE FUNCTION touch_ui_translations_updated_at();
