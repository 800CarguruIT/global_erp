import { getCachedTranslation, saveTranslation, computeChecksum } from "./translationsRepo";
import { translateText } from "./translateWithAI";

export async function getTranslation(source: string, lang: string): Promise<string> {
  if (!source) return source;
  const normalizedLang = lang?.toLowerCase() || "en";

  // English passthrough
  if (normalizedLang === "en") return source;

  const cached = await getCachedTranslation(source, normalizedLang);
  const sourceChecksum = computeChecksum(source);
  if (cached && cached.checksum === sourceChecksum) {
    return cached.translated_text;
  }

  const translated = await translateText(source, normalizedLang);
  await saveTranslation(source, normalizedLang, translated);
  return translated;
}
