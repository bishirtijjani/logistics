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

const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase()
// Categories store a 6-digit hex; append alpha for a soft tile background.
const tintFor = (c) => `${c.color || '#7C3AED'}1A`

function TileShell({ category, dragging }) {
  return (
    <div
      className={`flex w-full flex-col overflow-hidden rounded-2xl border bg-surface text-left dark:bg-dark-surface ${
        dragging
          ? 'border-primary shadow-2xl ring-2 ring-primary/40'
          : 'border-surface-muted dark:border-dark-surface-muted'
      }`}
      style={{ minHeight: 100 }}
    >
      <div
        className="flex h-[56px] items-center justify-center"
        style={{ backgroundColor: tintFor(category) }}
      >
        <span className="text-xl font-black" style={{ color: category.color || '#7C3AED' }}>
          {initialOf(category.name)}
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-1.5 pb-2 pt-1.5">
        <span className="line-clamp-2 text-center text-[10px] font-extrabold leading-tight text-text dark:text-dark-text">
          {category.name}
        </span>
        {category.special && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted dark:text-dark-muted">
            Tile
          </span>
        )}
      </div>
    </div>
  )
}

export default function HomeCategoriesPage() {
  const dispatch = useDispatch()
  const { categories, loading, saving } = useSelector((s) => s.homeCategories)
  const [order, setOrder] = useState([])
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)

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
    setOrder(serverOrder)
    seededRef.current = true
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

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
  const resetLayout = () => commit(serverOrder)

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
      <div className="rounded-xl border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface p-4">
        <div className="flex items-center justify-between px-1 pb-4">
          <span className="text-lg font-black text-text dark:text-dark-text">What do you need?</span>
          <span className="text-xs font-bold text-primary">See all →</span>
        </div>

        {shown.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted dark:text-dark-muted">
            No tiles yet. Add some from the list below to build the Home grid.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-[4%] gap-y-5">
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
                  className={`group relative w-full select-none ${
                    dragging ? 'z-10 touch-none' : 'touch-pan-y'
                  }`}
                >
                  <div className={dragging ? 'scale-105 transition-transform' : ''}>
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

        <div className="mt-4 px-1 text-xs text-muted dark:text-dark-muted">
          {shown.length} tile{shown.length === 1 ? '' : 's'} show on the app home
        </div>
      </div>

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
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-[4%] gap-y-4">
              {available.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => show(c.id)}
                  className="group relative w-full transition-shadow hover:shadow-md rounded-2xl"
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
