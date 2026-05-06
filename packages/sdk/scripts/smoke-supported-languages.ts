// Probe /v1/categories with each language we claim to support.
// Compares the returned `title`s — if two languages return identical titles,
// one of them is probably falling back to the default (= not actually localized).
//
// Run: npx tsx scripts/smoke-supported-languages.ts

import { SUPPORTED_LANGUAGES, ToncastClient } from "../src";

async function probe(lang: string) {
  const client = new ToncastClient({ language: lang });
  const cats = await client.categories.list();
  return cats.map((c) => `${c.id}=${c.title}`).join(" | ");
}

async function main() {
  console.log("Supported languages claimed by SDK:", SUPPORTED_LANGUAGES.join(", "));
  console.log();

  const baseline = await probe("en");
  console.log(`en: ${baseline}\n`);

  const seen = new Map<string, string[]>();
  seen.set(baseline, ["en"]);

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === "en") continue;
    const out = await probe(lang);
    const sameAsEn = out === baseline ? "  ⚠ identical to en" : "";
    console.log(`${lang}: ${out}${sameAsEn}`);
    const key = out;
    const existing = seen.get(key);
    if (existing) existing.push(lang);
    else seen.set(key, [lang]);
  }

  console.log("\n=== Groups (identical responses → likely same/missing translation) ===");
  for (const [, langs] of seen) {
    if (langs.length > 1) {
      console.log(`  ${langs.join(", ")}`);
    }
  }

  // Also try a few "NOT in our list" languages to see if backend supports them
  console.log("\n=== Probing langs we don't claim ===");
  for (const lang of ["ja", "ko", "tr", "uk", "id"]) {
    const out = await probe(lang);
    const matchEn =
      out === baseline ? " (= en fallback)" : " (DIFFERENT from en — backend supports!)";
    console.log(`${lang}: ${out.slice(0, 100)}…${matchEn}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
