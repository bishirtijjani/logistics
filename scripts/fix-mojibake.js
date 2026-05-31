/**
 * fix-mojibake.js - repair double-encoded UTF-8 ("mojibake") in source files.
 *
 * Some files had their UTF-8 punctuation decoded as Windows-1252 and re-saved,
 * mangling the naira sign, middle dot, ellipsis, dashes and curly quotes into
 * 2-3 byte garbage.
 *
 * For each target character we DERIVE its exact mojibake form from byte values
 * (take the char's real UTF-8 bytes, reinterpret each byte as cp1252), then
 * replace only that exact multi-char garbage sequence with the correct char.
 * This touches nothing else - emoji and already-correct symbols are safe, so it
 * works even on files that mix good characters with mojibake. The script itself
 * contains NO non-ASCII characters (nothing for an editor to re-mangle).
 *
 * Usage:  node scripts/fix-mojibake.js
 */

const fs = require('fs')
const path = require('path')
const iconv = require(path.join(__dirname, '..', 'backend', 'node_modules', 'iconv-lite'))

const ROOTS = [
  path.join(__dirname, '..', 'merchant-dashboard', 'src'),
  path.join(__dirname, '..', 'admin-dashboard', 'src'),
]
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html'])

// Characters that get mangled, by code point. We build the mojibake search
// string for each from its true UTF-8 bytes decoded as Windows-1252.
const TARGET_CODEPOINTS = [
  0x20a6, // naira sign
  0x2026, // ellipsis
  0x2014, // em dash
  0x2013, // en dash
  0x201c, // left double quote
  0x201d, // right double quote
  0x2018, // left single quote
  0x2019, // right single quote
  0x2022, // bullet
  0x00b7, // middle dot
]

const pairs = TARGET_CODEPOINTS.map((cp) => {
  const correct = String.fromCodePoint(cp)
  const moji = iconv.decode(Buffer.from(correct, 'utf8'), 'win1252')
  return [moji, correct]
})
// non-breaking space -> normal space
pairs.push([iconv.decode(Buffer.from(String.fromCodePoint(0x00a0), 'utf8'), 'win1252'), ' '])
// Apply longest garbage sequences first so a 2-char one can't pre-empt a 3-char one.
pairs.sort((a, b) => b[0].length - a[0].length)

// Raw-byte signatures of the mojibake lead chars, used to detect + to report
// anything still unmapped after the pass: 'A^' (C3 82), 'a^' (C3 A2), 'A~'(C3 83).
const SIGS = [Buffer.from([0xc3, 0x82]), Buffer.from([0xc3, 0xa2]), Buffer.from([0xc3, 0x83])]
const hasSig = (buf) => SIGS.some((s) => buf.includes(s))

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (EXTS.has(path.extname(e.name))) out.push(p)
  }
  return out
}

const repoRoot = path.join(__dirname, '..')
const changed = []
const leftovers = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const before = fs.readFileSync(file)
    if (!hasSig(before)) continue

    let text = before.toString('utf8')
    let hits = 0
    for (const [bad, good] of pairs) {
      const n = text.split(bad).length - 1
      if (n > 0) { hits += n; text = text.split(bad).join(good) }
    }

    const after = Buffer.from(text, 'utf8')
    if (!after.equals(before)) {
      fs.writeFileSync(file, after)
      changed.push({ file: path.relative(repoRoot, file), hits })
    }
    if (hasSig(after)) {
      // Show a few escaped samples of whatever lead bytes remain, for review.
      const samples = new Set()
      for (let i = 0; i < text.length - 1; i++) {
        const c = text.charCodeAt(i)
        if (c === 0xc2 || c === 0xc3 || c === 0xe2) samples.add(JSON.stringify(text.substr(i, 3)))
      }
      leftovers.push({ file: path.relative(repoRoot, file), samples: [...samples].slice(0, 12) })
    }
  }
}

console.log('\nFixed mojibake in ' + changed.length + ' file(s):')
for (const c of changed.sort((a, b) => b.hits - a.hits)) console.log('   ' + String(c.hits).padStart(4) + 'x  ' + c.file)

if (leftovers.length) {
  console.log('\nStill has unmapped sequences (review):')
  for (const l of leftovers) console.log('   ' + l.file + '  ->  ' + l.samples.join('  '))
} else {
  console.log('\nNo leftover mojibake markers detected.')
}
console.log('')
