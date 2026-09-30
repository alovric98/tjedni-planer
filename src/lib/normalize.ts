export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d")
    .trim();
}

/**
 * Recept može izričito tražiti smrznuto ("smrznuti grašak", "špinat
 * zamrznuti"). Bez te riječi kalkulator uvijek preferira svježe. Vraća naziv
 * bez te riječi (za uparivanje/pravila) i zastavicu.
 */
export function splitFrozenRequest(name: string): { cleaned: string; frozen: boolean } {
  const re = /\b(smrznut\w*|zamrznut\w*)\b/gi;
  if (!re.test(name)) return { cleaned: name, frozen: false };
  return { cleaned: name.replace(re, " ").replace(/\s+/g, " ").trim(), frozen: true };
}
