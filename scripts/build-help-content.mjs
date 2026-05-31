/**
 * build-help-content.mjs — sync the Help Center guides into a dashboard app so
 * the in-app "?" help panel renders the SAME content as the web Help Center,
 * with zero drift (regenerated on every dev/build).
 *
 * For the given role it:
 *   1. writes <target>/src/help/helpContent.js  (categories + guides incl. body)
 *   2. copies the role's screenshots into <target>/public/help/screenshots/<role>/
 *
 * Usage:  node scripts/build-help-content.mjs <role> [targetDir]
 *   (npm hook runs it as:  node ../scripts/build-help-content.mjs merchant .)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(__dirname, '..')

const role = process.argv[2]
if (!role) {
  console.error('usage: build-help-content.mjs <role> [targetDir]')
  process.exit(1)
}
const target = path.resolve(process.argv[3] || process.cwd())

const HELP = path.join(REPO, 'docs', 'help')
const manifest = JSON.parse(fs.readFileSync(path.join(HELP, 'manifest.json'), 'utf8'))

const guides = manifest.guides
  .filter((g) => g.role === role)
  .map((g) => ({
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    category: g.category,
    order: g.order ?? 999,
    keywords: g.keywords || [],
    body: fs.readFileSync(path.join(HELP, g.file), 'utf8'),
  }))

const outDir = path.join(target, 'src', 'help')
fs.mkdirSync(outDir, { recursive: true })
const mod =
  '// AUTO-GENERATED from /docs/help by scripts/build-help-content.mjs — do not edit.\n' +
  '// Re-run `node scripts/build-help-content.mjs ' + role + '` (runs automatically on dev/build).\n' +
  'export const helpCategories = ' + JSON.stringify(manifest.categories || []) + '\n' +
  'export const helpGuides = ' + JSON.stringify(guides) + '\n'
fs.writeFileSync(path.join(outDir, 'helpContent.js'), mod)

// Copy the shared search algorithm so the in-app panel uses identical logic.
fs.copyFileSync(path.join(REPO, 'website', 'app', 'help', 'helpSearch.js'), path.join(outDir, 'helpSearch.js'))

// Copy this role's screenshots so in-app images resolve at /help/screenshots/<role>/...
const srcShots = path.join(REPO, 'website', 'public', 'help', 'screenshots', role)
const dstShots = path.join(target, 'public', 'help', 'screenshots', role)
let copied = 0
if (fs.existsSync(srcShots)) {
  fs.mkdirSync(dstShots, { recursive: true })
  for (const f of fs.readdirSync(srcShots)) {
    fs.copyFileSync(path.join(srcShots, f), path.join(dstShots, f))
    copied++
  }
}

console.log(`help content synced for ${role}: ${guides.length} guides, ${copied} screenshots → ${path.relative(REPO, target)}`)
