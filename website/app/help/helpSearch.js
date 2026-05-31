// Shared help-center search — word/relevance based, with typo tolerance.
//
// Splits the query into meaningful words (dropping filler like how/to/a/the),
// matches each word as a substring (so "withdraw" hits "withdrawal", "product"
// hits "products"), falls back to a near-match for typos (so "withdrwal" hits
// "withdrawal", "recieving" hits "receiving"), then ranks guides by how many
// query words they cover — weighting title/keyword hits far above body hits.
//
// SINGLE SOURCE OF TRUTH: this file is copied verbatim into each dashboard
// (src/help/helpSearch.js) by scripts/build-help-content.mjs, and imported by
// the website's HelpBrowser + HelpSidebar. Edit here only.

const STOPWORDS = new Set(
  ('a an and any are as at be but by can cant could do does doing dont for from get got had has have how i if in into is it its just like me my no not of on or our out should so some that the their them then there these they this to up want was way we what when where which who why will with would you your yours')
    .split(' ')
)

const tokenize = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []

// True if `a` is within 1 edit (substitution, insertion, deletion, or adjacent
// transposition — i.e. optimal string alignment distance <= 1) of `b`.
// Adjacent transposition is what makes it forgiving of "recieving"/"prodcut".
function within1(a, b) {
  if (a === b) return true
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  while (i < la && i < lb && a[i] === b[i]) i++
  if (i === la || i === lb) return true // one trailing insert/delete
  if (la === lb) {
    let sub = true
    for (let k = i + 1; k < la; k++) if (a[k] !== b[k]) { sub = false; break }
    if (sub) return true
    if (a[i] === b[i + 1] && a[i + 1] === b[i]) {
      let tr = true
      for (let k = i + 2; k < la; k++) if (a[k] !== b[k]) { tr = false; break }
      if (tr) return true
    }
    return false
  }
  if (la === lb + 1) { // a has one extra char
    for (let k = i; k < lb; k++) if (a[k + 1] !== b[k]) return false
    return true
  }
  for (let k = i; k < la; k++) if (a[k] !== b[k + 1]) return false // b has one extra char
  return true
}

/**
 * @param {string} query
 * @param {Array<{slug,title,summary,keywords,body?,text?,order?}>} guides
 * @returns {Array|null} ranked guides (most relevant first), or null for an empty query
 */
export function searchGuides(query, guides) {
  const raw = tokenize(query)
  let terms = raw.filter((t) => t.length >= 2 && !STOPWORDS.has(t))
  if (terms.length === 0) terms = raw.filter((t) => t.length >= 2) // query was all stopwords
  if (terms.length === 0) return null
  terms = [...new Set(terms)]

  const scored = []
  for (const g of guides) {
    const titleHay = `${g.title} ${(g.keywords || []).join(' ')}`.toLowerCase()
    const bodyHay = `${g.summary || ''} ${g.body || ''} ${g.text || ''}`.toLowerCase()
    let titleToks = null, bodyToks = null // tokenized lazily, only for typo fallback
    let matched = 0, weight = 0
    for (const t of terms) {
      let inTitle = titleHay.includes(t)
      let inBody = inTitle || bodyHay.includes(t)
      let fuzzy = false
      if (!inBody && t.length >= 4) {
        if (!titleToks) { titleToks = tokenize(titleHay); bodyToks = tokenize(bodyHay) }
        if (titleToks.some((tok) => tok[0] === t[0] && within1(t, tok))) { inTitle = inBody = true; fuzzy = true }
        else if (bodyToks.some((tok) => tok[0] === t[0] && within1(t, tok))) { inBody = true; fuzzy = true }
      }
      if (inBody) matched++
      weight += (inTitle ? (fuzzy ? 4 : 5) : 0) + (inBody && !inTitle ? 1 : 0)
    }
    if (matched > 0) scored.push({ g, coverage: matched / terms.length, weight, order: g.order || 0 })
  }
  // Most query-words covered wins; ties broken by weighted relevance, then order.
  scored.sort((a, b) => b.coverage - a.coverage || b.weight - a.weight || a.order - b.order)
  return scored.map((s) => s.g)
}
