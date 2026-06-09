/**
 * test-help-search.mjs - measure help-search relevance against the generated
 * query corpus. Reports top-1 / top-3 hit rates both globally (web landing,
 * all guides) and role-scoped (in-app panel, same-role guides), and lists misses.
 *
 * Run:  node scripts/test-help-search.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { searchGuides } from '../website/app/help/helpSearch.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HELP = path.join(__dirname, '..', 'docs', 'help')
const manifest = JSON.parse(fs.readFileSync(path.join(HELP, 'manifest.json'), 'utf8'))
const guides = manifest.guides.map((g) => ({
  slug: g.slug, role: g.role, title: g.title, summary: g.summary,
  keywords: g.keywords || [], order: g.order || 0,
  body: fs.readFileSync(path.join(HELP, g.file), 'utf8'),
}))
const roleOf = Object.fromEntries(guides.map((g) => [g.slug, g.role]))
const corpus = JSON.parse(fs.readFileSync(path.join(HELP, '_search-corpus.json'), 'utf8'))

let total = 0
const g1 = { top1: 0, top3: 0 }, r1 = { top1: 0, top3: 0 }
const misses = []

for (const { slug, queries } of corpus) {
  const role = roleOf[slug]
  const roleGuides = guides.filter((g) => g.role === role)
  for (const q of queries) {
    total++
    const global = (searchGuides(q, guides) || []).map((g) => g.slug)
    const scoped = (searchGuides(q, roleGuides) || []).map((g) => g.slug)
    const gi = global.indexOf(slug), ri = scoped.indexOf(slug)
    if (gi === 0) g1.top1++; if (gi >= 0 && gi < 3) g1.top3++
    if (ri === 0) r1.top1++; if (ri >= 0 && ri < 3) r1.top3++
    if (!(ri >= 0 && ri < 3)) misses.push({ q, expected: slug, scoped: scoped.slice(0, 3) })
  }
}

const pct = (n) => `${n} / ${total} (${(100 * n / total).toFixed(1)}%)`
console.log(`\nCorpus: ${total} queries across ${corpus.length} guides\n`)
console.log(`GLOBAL (web landing - all guides):   top-1 ${pct(g1.top1)} · top-3 ${pct(g1.top3)}`)
console.log(`ROLE-SCOPED (in-app panel):          top-1 ${pct(r1.top1)} · top-3 ${pct(r1.top3)}`)
console.log(`\nRole-scoped misses (not in top-3) - ${misses.length}:`)
for (const m of misses) console.log(`  "${m.q}"  → expected ${m.expected}, got [${m.scoped.join(', ') || '-'}]`)
console.log('')
