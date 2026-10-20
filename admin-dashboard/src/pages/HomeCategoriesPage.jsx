import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { GripVertical, Save, Search, X, Plus, RotateCcw, ChevronLeft } from 'lucide-react'
import {
  fetchHomeCategories,
  updateHomeCategories,
} from '../store/slices/homeCategoriesSlice'
import { useDragReorder } from '../lib/useDragReorder'
import { useTheme } from '../contexts/ThemeContext'
import { customerTheme, resolveCategoryIcon } from '../lib/homeTileTheme'

// Tile shell mirrors the customer app home tile

function TileShell({ category, dragging, accent }) {
  const { isDark } = useTheme()
  const theme = customerTheme(isDark)
  const withAlpha = (hex, alpha) =>
    typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex
  const accentColor = accent || theme.accentFor(category)
  const second = withAlpha(accentColor, 'B3')
  const name = category.name || ''
  return (
    <div
      className="w-full text-left select-none"
      style={{
        borderRadius: 22,
        paddingTop: 16,
        paddingBottom: 16,
        paddingLeft: 8,
        paddingRight: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        boxShadow: dragging ? '0 12px 40px rgba(9,9,11,0.18)' : '0 6px 16px rgba(9,9,11,0.06)',
        ...(dragging ? { transform: 'scale(1.05)', transition: 'transform 120ms ease' } : {}),
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 10,
          position: 'relative',
          background: `linear-gradient(135deg, ${accentColor}, ${second})`,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i
            className={`mdi mdi-${resolveCategoryIcon(category)}`}
            style={{ fontSize: 26, color: theme.iconOnChip, lineHeight: 1 }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: 'rgba(255,255,255,0.45)',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: theme.nameColor,
          textAlign: 'center',
          letterSpacing: '-0.2px',
          display: 'block',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </div>
  )
}

export default function HomeCategoriesPage() {
  const dispatch = useDispatch()
  const { categories, loading, saving } = useSelector((s) => s.homeCategories)
  const [order, setOrder] = useState([])
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)
  const { isDark } = useTheme()
  const theme = customerTheme(isDark)

  // Track each tile's geometry so the pointer drag can pick the nearest slot.
  const tiles = useRef(new Map())

  useEffect(() => {
    dispatch(fetchHomeCategories())
  }, [dispatch])

  const byId = useMemo(() => {
    const map = new Map()
    categories.forEach((c) => map.set(c.id, c))
    return map
  }, [categories])

  const defaultOrder = useMemo(() => {
    const slugs = ['restaurant', 'grocery', 'pharmacy']
    const bySlug = new Map(categories.map((c) => [c.slug, c.id]))
    const ids = slugs.map((s) => bySlug.get(s)).filter(Boolean)
    ids.push('__shops__', '__package__')
    // avoid duplicates if somehow present
    return Array.from(new Set(ids))
  }, [categories])

  const serverOrder = useMemo(
    () => categories.filter((c) => c.featured).map((c) => c.id),
    [categories]
  )

  // Seed the working order from the server ONCE (and again after a save), and
  // never while the admin has unsaved edits - otherwise a background refetch
  // would wipe the arrangement they are working on.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const seededRef = useRef(false)
  useEffect(() => {
    if (!categories.length) return
    if (seededRef.current && dirtyRef.current) return
    setOrder(serverOrder.length ? serverOrder : defaultOrder)
    seededRef.current = true
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, defaultOrder, serverOrder])

  const shown = order.map((id) => byId.get(id)).filter(Boolean)
  const shownSet = useMemo(() => new Set(order), [order])

  const available = useMemo(() => {
    const q = search.trim().toLowerCase()
    return categories
      .filter((c) => !shownSet.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (b._count?.merchants ?? 0) - (a._count?.merchants ?? 0) ||
          a.name.localeCompare(b.name)
      )
  }, [categories, shownSet, search])

  const commit = (next) => {
    setOrder(next)
    setDirty(true)
  }

  const { dragId, registerItem, setDropResolver, startDrag } = useDragReorder(order, commit, {
    live: true,
  })

  // Nearest-tile resolver: the drop target is the shown tile whose center is
  // closest to the pointer. Registered once so we don't mutate a ref mid-render.
  useEffect(() => {
    setDropResolver((x, y) => {
      let best = null
      let bestDist = Infinity
      tiles.current.forEach((el, id) => {
        const r = el.getBoundingClientRect()
        const dx = x - (r.left + r.width / 2)
        const dy = y - (r.top + r.height / 2)
        const d = dx * dx + dy * dy
        if (d < bestDist) {
          bestDist = d
          best = id
        }
      })
      return best
    })
    return () => setDropResolver(null)
  }, [setDropResolver])

  const show = (id) => commit([...order, id])
  const hide = (id) => commit(order.filter((x) => x !== id))
  const resetLayout = () => commit(serverOrder.length ? serverOrder : defaultOrder)

  const onSave = async () => {
    try {
      await dispatch(
        updateHomeCategories(order.map((id) => ({ id, featured: true })))
      ).unwrap()
      setDirty(false)
      toast.success('Home layout saved')
    } catch (err) {
      toast.error(err?.message || 'Save failed')
    }
  }

  if (loading && categories.length === 0) {
    return <div className="p-8 text-center text-muted dark:text-dark-muted">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <Link
        to="/categories"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted dark:text-dark-muted hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Categories
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Home layout</h1>
          <p className="text-sm text-muted dark:text-dark-muted mt-1">
            Exactly what customers see in the app&apos;s &quot;What do you need?&quot; grid. Drag tiles to reorder, tap ✕ to hide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetLayout}
            disabled={!dirty}
            className="inline-flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg text-sm font-medium text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Save'}
          </button>
        </div>
      </div>

      {/* WYSIWYG grid - mirrors the app Home "What do you need?" section */}
      <div className="mx-auto w-full max-w-[390px]">
        <div className="rounded-[44px] border border-surface-muted dark:border-dark-surface-muted shadow-xl overflow-hidden" style={{ backgroundColor: theme.canvas, padding: '20px' }}>
        <div className="flex items-center justify-between px-1 pb-4">
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px" }} className="text-text dark:text-dark-text">What do you need?</span>
          <span style={{ width: 30, height: 3.5, borderRadius: 2 }} className="bg-primary dark:bg-[#FB923C]" />
        </div>

        {shown.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted dark:text-dark-muted">
            No tiles yet. Add some from the list below to build the Home grid.
          </div>
        ) : (
          <div className="flex flex-wrap" style={{ marginLeft: -6, marginRight: -6, rowGap: 12 }}>
            {shown.map((c) => {
              const dragging = dragId === c.id
              return (
                <div
                  key={c.id}
                  ref={(el) => {
                    registerItem(c.id)(el)
                    if (el) tiles.current.set(c.id, el)
                    else tiles.current.delete(c.id)
                  }}
                  onPointerDown={startDrag(c.id)}
                  className={`group relative select-none ${
                    dragging ? 'z-10 touch-none' : 'touch-pan-y'
                  }`}
                  style={{ width: '33.333%', paddingLeft: 6, paddingRight: 6 }}
                >
                  <div>
                    <TileShell category={c} dragging={dragging} />
                  </div>

                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white"
                  >
                    <GripVertical className="h-3 w-3" />
                  </span>

                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => hide(c.id)}
                    aria-label={`Remove ${c.name}`}
                    className="absolute -right-1.5 -top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface text-muted dark:text-dark-muted shadow-sm hover:bg-error hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>

      <p className="text-center text-xs text-muted dark:text-dark-muted">
        {shown.length} tile{shown.length === 1 ? '' : 's'} show on the app home
      </p>

      {/* Picker */}
      <div className="rounded-xl border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface">
        <div className="border-b border-surface-muted dark:border-dark-surface-muted px-5 py-4">
          <h2 className="text-base font-semibold text-text dark:text-dark-text">Add a tile</h2>
          <p className="mt-0.5 text-xs text-muted dark:text-dark-muted">
            Tap a tile to add it to the Home grid. Inactive categories stay hidden in the app until you re-activate them.
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted dark:text-dark-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tiles"
              className="w-full border border-surface-muted dark:border-dark-surface-muted rounded-lg pl-9 pr-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text placeholder:text-muted dark:placeholder:text-dark-muted outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div className="p-3">
          {available.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted dark:text-dark-muted">
              Nothing to add - every matching tile is already on Home.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {available.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => show(c.id)}
                  className="group relative transition-shadow hover:shadow-md"
                  style={{ width: 104 }}
                >
                  <TileShell category={c} dragging={false} />
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Plus className="h-3 w-3" />
                  </span>
                  {!c.isActive && (
                    <span className="absolute left-1 top-1 rounded bg-gray-900/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                      Off
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
