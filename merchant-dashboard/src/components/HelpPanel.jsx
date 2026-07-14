import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HelpCircle, X, ArrowLeft, Search, ChevronRight } from 'lucide-react'
import { helpGuides, helpCategories } from '../help/helpContent.js'
import { searchGuides } from '../help/helpSearch.js'

// Map the current route to the most relevant guide, so opening Help jumps
// straight to what the merchant is looking at.
const ROUTE_GUIDE = [
  [/\/dashboard\/orders/, 'receiving-orders'],
  [/\/dashboard\/menu/, 'managing-products'],
  [/\/dashboard\/earnings/, 'getting-paid'],
  [/\/dashboard\/settings/, 'shop-settings'],
  [/\/dashboard\/support/, 'getting-help'],
]

const stripLeadingH1 = (b) => b.replace(/^\s*#\s+.*\r?\n+/, '')

// Floating help button that can be dragged out of the way if it covers
// content: it follows the pointer freely, snaps to the nearest screen edge on
// release, and remembers its spot across visits. A plain tap still opens Help.
const FAB_SIZE = 48
const FAB_MARGIN = 20
const FAB_POS_KEY = 'help-fab-pos'

function loadFabPos() {
  try {
    const p = JSON.parse(localStorage.getItem(FAB_POS_KEY))
    if (p && (p.side === 'left' || p.side === 'right') && Number.isFinite(p.yFrac)) return p
  } catch { /* corrupt value: fall back to default corner */ }
  return null
}

function HelpFab({ onOpen }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const pending = useRef(null)
  const snapTimer = useRef(null)
  const [pos, setPos] = useState(loadFabPos)
  const [xy, setXy] = useState(null)

  const finishSnap = () => {
    clearTimeout(snapTimer.current)
    if (pending.current) {
      setPos(pending.current)
      pending.current = null
      setXy(null)
    }
  }

  useEffect(() => () => clearTimeout(snapTimer.current), [])

  const onPointerDown = (e) => {
    finishSnap()
    const r = ref.current.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false }
    ref.current.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return
    d.moved = true
    setXy({
      x: Math.min(Math.max(e.clientX - d.dx, 4), window.innerWidth - FAB_SIZE - 4),
      y: Math.min(Math.max(e.clientY - d.dy, 4), window.innerHeight - FAB_SIZE - 4),
      snapping: false,
    })
  }

  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    const side = e.clientX - d.dx + FAB_SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right'
    const y = Math.min(Math.max(e.clientY - d.dy, FAB_MARGIN), window.innerHeight - FAB_SIZE - FAB_MARGIN)
    const next = { side, yFrac: y / window.innerHeight }
    try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
    // Glide to the edge, then hand positioning back to the anchored style.
    pending.current = next
    setXy({ x: side === 'left' ? FAB_MARGIN : window.innerWidth - FAB_SIZE - FAB_MARGIN, y, snapping: true })
    snapTimer.current = setTimeout(finishSnap, 200)
  }

  const style = xy
    ? { left: xy.x, top: xy.y, transition: xy.snapping ? 'left .2s ease-out, top .2s ease-out' : 'none' }
    : pos
      ? { [pos.side]: FAB_MARGIN, top: `clamp(${FAB_MARGIN}px, ${(pos.yFrac * 100).toFixed(2)}vh, calc(100vh - ${FAB_SIZE + FAB_MARGIN}px))` }
      : { right: FAB_MARGIN, bottom: FAB_MARGIN }

  return (
    <button
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; setXy(null) }}
      onClick={() => { if (!xy) onOpen() }}
      aria-label="Help"
      title="Help"
      style={style}
      className="fixed z-40 w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary-700 active:scale-95 touch-none select-none cursor-grab active:cursor-grabbing"
    >
      <HelpCircle className="w-6 h-6" />
    </button>
  )
}

export default function HelpPanel() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [slug, setSlug] = useState(null)
  const location = useLocation()

  const contextualSlug = useMemo(() => {
    const m = ROUTE_GUIDE.find(([re]) => re.test(location.pathname))
    return m ? m[1] : null
  }, [location.pathname])

  const openPanel = () => { setSlug(contextualSlug); setQ(''); setOpen(true) }

  const query = q.trim().toLowerCase()
  const results = useMemo(() => (query ? searchGuides(query, helpGuides) : null), [query])

  const selected = slug ? helpGuides.find((g) => g.slug === slug) : null
  const cats = [...helpCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const GuideLink = ({ href = '', children }) => {
    const m = href.match(/\/help\/[a-z]+\/([a-z0-9-]+)/)
    if (m && helpGuides.some((g) => g.slug === m[1])) {
      return (
        <a href={href} onClick={(e) => { e.preventDefault(); setSlug(m[1]); }} className="text-primary hover:underline cursor-pointer">
          {children}
        </a>
      )
    }
    return <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">{children}</a>
  }

  const mdComponents = {
    h2: (p) => <h2 className="text-base font-bold text-text dark:text-dark-text mt-6 mb-2" {...p} />,
    h3: (p) => <h3 className="text-sm font-semibold text-text dark:text-dark-text mt-4 mb-1" {...p} />,
    p: (p) => <p className="text-sm text-text dark:text-dark-text leading-relaxed my-2" {...p} />,
    ul: (p) => <ul className="list-disc pl-5 my-2 text-sm text-text dark:text-dark-text space-y-1" {...p} />,
    ol: (p) => <ol className="list-decimal pl-5 my-2 text-sm text-text dark:text-dark-text space-y-1" {...p} />,
    li: (p) => <li className="leading-relaxed" {...p} />,
    strong: (p) => <strong className="font-semibold text-text dark:text-dark-text" {...p} />,
    a: GuideLink,
    blockquote: (p) => <blockquote className="my-3 border-l-4 border-primary/40 bg-primary/5 dark:bg-primary/10 rounded-r-lg px-3 py-2 text-sm text-text dark:text-dark-text [&_p]:my-1" {...p} />,
    img: (p) => <img className="w-full rounded-lg border border-surface-muted dark:border-dark-surface-muted my-3" loading="lazy" {...p} />,
    table: (p) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse" {...p} /></div>,
    th: (p) => <th className="border border-surface-muted dark:border-dark-surface-muted bg-surface-muted dark:bg-dark-surface-muted px-2 py-1 text-left font-semibold" {...p} />,
    td: (p) => <td className="border border-surface-muted dark:border-dark-surface-muted px-2 py-1 align-top" {...p} />,
    hr: () => <hr className="my-4 border-surface-muted dark:border-dark-surface-muted" />,
    code: (p) => <code className="px-1 py-0.5 rounded bg-surface-muted dark:bg-dark-surface-muted text-xs" {...p} />,
  }

  return (
    <>
      {!open && <HelpFab onOpen={openPanel} />}

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-surface dark:bg-dark-surface shadow-2xl flex flex-col animate-[slideIn_.2s_ease-out]">
            <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-surface-muted dark:border-dark-surface-muted shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {selected && (
                  <button onClick={() => setSlug(null)} aria-label="Back" className="p-1.5 -ml-1.5 rounded-lg text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <span className="font-bold text-text dark:text-dark-text truncate">
                  {selected ? selected.title : 'Help'}
                </span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-lg text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!selected && (
              <div className="px-4 py-3 border-b border-surface-muted dark:border-dark-surface-muted shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted dark:text-dark-muted" />
                  <input
                    type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-sm text-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <article className="px-4 py-4">
                  <p className="text-sm text-muted dark:text-dark-muted mb-3">{selected.summary}</p>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {stripLeadingH1(selected.body)}
                  </ReactMarkdown>
                </article>
              ) : results ? (
                <div className="p-3 space-y-1">
                  {results.length === 0 ? (
                    <p className="text-sm text-muted dark:text-dark-muted px-2 py-4">No results for &ldquo;{q}&rdquo;.</p>
                  ) : results.map((g) => <GuideRow key={g.slug} g={g} onClick={() => setSlug(g.slug)} />)}
                </div>
              ) : (
                <div className="p-3 space-y-5">
                  {cats.map((cat) => {
                    const items = helpGuides.filter((g) => g.category === cat.id).sort((a, b) => a.order - b.order)
                    if (!items.length) return null
                    return (
                      <div key={cat.id}>
                        <p className="text-[0.65rem] font-extrabold uppercase tracking-widest text-muted dark:text-dark-muted px-2 mb-1">{cat.label}</p>
                        <div className="space-y-1">{items.map((g) => <GuideRow key={g.slug} g={g} onClick={() => setSlug(g.slug)} />)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
      <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>
    </>
  )
}

function GuideRow({ g, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors flex items-start gap-2 group">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text dark:text-dark-text">{g.title}</div>
        <div className="text-xs text-muted dark:text-dark-muted truncate">{g.summary}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted dark:text-dark-muted mt-0.5 shrink-0 group-hover:text-primary" />
    </button>
  )
}
