#!/usr/bin/env node
/**
 * One-shot polish pass on mobile/customer-app/src/i18n/ha.json.
 *
 * Three rules:
 *   1. Switch the address form from masculine-singular "ka" / "kai" /
 *      "kake" / "kana" / "maka" / "naka" / "kanka" / "-nka" / "-rka" /
 *      "ɗinka" to plural-neutral "ku" / "kuke" / "kuna" / "muku" / "naku" /
 *      "kanku" / "-nku" / "-rku" / "ɗinku" — more inclusive for a mass-
 *      market app.
 *   2. Replace "mai keke" (motorcycle-rider) with the English loanword
 *      "rider" — vehicle-neutral, future-proofs car / bicycle deliveries.
 *   3. Replace "takardar shaida" (certificate) with "takardar likita"
 *      (doctor's prescription) — the correct pharmacy term.
 *
 * The idiom "kai tsaye" ("live" / "real-time" / "directly") must be
 * preserved — without the placeholder dance below it would become "ku
 * tsaye" ("you stand up"), which is meaningless and confusing.
 *
 * Run: node scripts/hausa-polish.js [--dry]
 *   --dry   print before/after for each change, do not write
 */

const fs = require('node:fs');
const path = require('node:path');

const HA_PATH = path.join(
  __dirname,
  '..',
  'mobile',
  'customer-app',
  'src',
  'i18n',
  'ha.json',
);

const dryRun = process.argv.includes('--dry');

// Replacement order matters. We protect idioms first, then do longer
// pronoun forms before shorter ones (so "kanka" gets caught before "ka",
// "kake" before "ka", etc.).
const PROTECT = [
  { from: /kai tsaye/g, placeholder: 'KAITSAYE' },
];

// JavaScript's `\b` recognizes only ASCII word characters. Hausa uses
// hooked letters (ɓ ɗ ƙ ƴ Ɓ Ɗ Ƙ Ƴ) which `\b` treats as non-word, so a
// pattern like `\bɗinka\b` mis-fires at the boundary before "ɗ". We use
// explicit Unicode lookaround instead.
//
// HAUSA_LETTER matches any letter we treat as part of a word — Latin
// alphabet plus the four Hausa hooked letters in both cases.
const HAUSA_LETTER = 'A-Za-zƁɓƊɗƘƙƳƴ';
const NOT_LETTER_BEFORE = `(?<![${HAUSA_LETTER}])`;
const NOT_LETTER_AFTER = `(?![${HAUSA_LETTER}])`;
const WB = (body) =>
  new RegExp(NOT_LETTER_BEFORE + body + NOT_LETTER_AFTER, 'g');

// Each entry is a pair: a lowercase pattern and the lowercase replacement.
// The runner expands each to a case-aware family so "Ka" at sentence start
// also becomes "Ku", and "KA" (rare) becomes "KU".
const PRONOUN_PAIRS = [
  // Possessive endings on the most common UI nouns we ship. The "-nka"
  // pattern is broad enough that we whitelist specific stems rather than
  // blanket-replace.
  ['ɗinka', 'ɗinku'],     // your X (very common)
  ['kanka', 'kanku'],     // yourself
  ['kana', 'kuna'],       // you are (doing)
  ['kake', 'kuke'],       // you (habitually) do
  ['maka', 'muku'],       // to/for you
  ['naka', 'naku'],       // yours
  ['asusunka', 'asusunku'],
  ['lambarka', 'lambarku'],
  ['bankinka', 'bankinku'],
  ['imelka', 'imelku'],
  ['bayanan ka', 'bayanan ku'],
  // Bare pronouns last so multi-letter forms above always win.
  ['kai', 'ku'],          // you (after idiom protection)
  ['ka', 'ku'],           // you (sg. masc.) → ku (pl.)
];

// Capitalize the first character of a Hausa word — falls back to JS's
// default `toUpperCase` since the Hausa hooked letters have proper Unicode
// case pairs (ɗ ↔ Ɗ etc.).
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const PRONOUN_REPLACEMENTS = PRONOUN_PAIRS.flatMap(([from, to]) => [
  { from: WB(from), to },
  { from: WB(capFirst(from)), to: capFirst(to) },
  // We deliberately do NOT add an all-caps form (e.g. "KA"); Hausa UI copy
  // doesn't use shouty-caps and false positives would be likelier than
  // intended matches.
]);

const TERM_REPLACEMENTS = [
  { from: WB('mai keke'), to: 'rider' },
  { from: WB('Mai keke'), to: 'Rider' },
  { from: WB('takardar shaida'), to: 'takardar likita' },
  { from: WB('Takardar shaida'), to: 'Takardar likita' },
];

function walk(node, fn, prefix = '') {
  if (typeof node === 'string') return fn(prefix, node);
  if (!node || typeof node !== 'object') return node;
  const out = Array.isArray(node) ? [] : {};
  for (const k of Object.keys(node)) {
    const child = walk(node[k], fn, prefix ? prefix + '.' + k : k);
    out[k] = child;
  }
  return out;
}

function applyReplacements(s) {
  let t = s;

  // 1. Protect idioms
  for (const p of PROTECT) {
    t = t.replace(p.from, p.placeholder);
  }
  // 2. Pronoun shift
  for (const r of PRONOUN_REPLACEMENTS) {
    t = t.replace(r.from, r.to);
  }
  // 3. Domain term fixes
  for (const r of TERM_REPLACEMENTS) {
    t = t.replace(r.from, r.to);
  }
  // 4. Restore idioms
  for (const p of PROTECT) {
    t = t.replace(new RegExp(p.placeholder, 'g'), p.from.source);
  }

  return t;
}

const raw = fs.readFileSync(HA_PATH, 'utf8');
const data = JSON.parse(raw);

const changes = [];
const updated = walk(data, (key, value) => {
  const next = applyReplacements(value);
  if (next !== value) {
    changes.push({ key, before: value, after: next });
  }
  return next;
});

console.log(`Hausa polish pass: ${changes.length} string(s) changed.`);

if (dryRun) {
  for (const c of changes) {
    console.log('\n--- ' + c.key + ' ---');
    console.log('BEFORE: ' + c.before);
    console.log('AFTER:  ' + c.after);
  }
  console.log('\n(dry run — no file written)');
} else {
  fs.writeFileSync(HA_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log('Wrote ' + HA_PATH);
}
