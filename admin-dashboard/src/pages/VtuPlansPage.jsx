import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus, Search, X, Pencil, Trash2, Check, Power, AlertTriangle,
  LayoutGrid, List, ChevronDown, ChevronRight, Smartphone, Wifi,
  Tv, Zap, Filter, MoreHorizontal,
} from 'lucide-react'
import api from '../lib/api'
import NumberInput from '../components/NumberInput.jsx'

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'AIRTIME',     label: 'Airtime',     icon: Smartphone },
  { key: 'DATA',        label: 'Data',        icon: Wifi },
  { key: 'CABLE',       label: 'Cable',       icon: Tv },
  { key: 'ELECTRICITY', label: 'Electricity', icon: Zap },
]

// Network catalogue lives in the DB and is admin-editable on /vtu-networks.
// This page just consumes it for dropdowns/buttons.

const DATA_PLAN_TYPES = ['SME', 'GIFTING', 'CORPORATE', 'AWOOF', 'DIRECT']
const PAGE_SIZES = [25, 50, 100]
const LOW_MARGIN_PCT = 5  // amber threshold
const UNDO_MS = 6000

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const fmt = (n) => `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

const margin = (cost, sell) => {
  const c = Number(cost || 0), s = Number(sell || 0)
  const naira = s - c
  const pct = c > 0 ? (naira / c) * 100 : 0
  return { naira, pct }
}

const marginTone = (cost, sell) => {
  const { naira, pct } = margin(cost, sell)
  if (Number(cost) === 0 && Number(sell) === 0) return 'neutral'
  if (naira <= 0) return 'bad'
  if (pct < LOW_MARGIN_PCT) return 'warn'
  return 'ok'
}

const parseSizeToMB = (s) => {
  if (!s) return Infinity
  const m = String(s).trim().toUpperCase().match(/([\d.]+)\s*(MB|GB|TB)?/)
  if (!m) return Infinity
  const v = parseFloat(m[1])
  const u = m[2] || 'MB'
  return u === 'TB' ? v * 1024 * 1024 : u === 'GB' ? v * 1024 : v
}

// ────────────────────────────────────────────────────────────────────────────
// Shared classnames
// ────────────────────────────────────────────────────────────────────────────

const cls = {
  input: 'w-full border border-surface-muted dark:border-dark-surface-muted rounded-lg px-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text placeholder:text-muted dark:placeholder:text-dark-muted outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  label: 'block text-xs font-semibold text-muted dark:text-dark-muted mb-1 uppercase tracking-wide',
  btnPrimary: 'inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors',
  btnGhost: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors',
  btnDanger: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-error hover:bg-error/10 transition-colors',
  pill: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function VtuPlansPage() {
  const [tab, setTab] = useState('DATA')
  const [view, setView] = useState('list')                // 'list' | 'matrix' (matrix only on DATA)
  const [search, setSearch] = useState('')
  const [networkFilter, setNetworkFilter] = useState('')   // string id or ''
  const [activeFilter, setActiveFilter] = useState('all')  // 'all' | 'active' | 'inactive'
  const [planTypeFilter, setPlanTypeFilter] = useState('') // DATA only

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState(() => new Set())

  const [sheet, setSheet] = useState(null)               // { mode, plan? } | null
  const [confirm, setConfirm] = useState(null)           // { title, message, tone, onConfirm } | null
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)

  // Network catalogue from /admin/vtu-networks, grouped by type.
  const [networksByType, setNetworksByType] = useState({
    AIRTIME: [], DATA: [], CABLE: [], ELECTRICITY: [],
  })

  useEffect(() => {
    let cancelled = false
    api.get('/admin/vtu-networks').then((res) => {
      if (cancelled) return
      const grouped = { AIRTIME: [], DATA: [], CABLE: [], ELECTRICITY: [] }
      for (const n of res.data.data || []) {
        if (!n.isActive) continue
        if (!grouped[n.type]) grouped[n.type] = []
        grouped[n.type].push({ id: n.providerNetworkId, name: n.name })
      }
      setNetworksByType(grouped)
    }).catch(() => toast.error('Failed to load networks'))
    return () => { cancelled = true }
  }, [])

  // ── fetch ───────────────────────────────────────────────────────────────
  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: tab, page, limit: pageSize })
      if (networkFilter) params.set('networkId', networkFilter)
      if (activeFilter !== 'all') params.set('isActive', activeFilter === 'active')
      const res = await api.get(`/admin/vtu-plans?${params}`)
      setPlans(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch {
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }, [tab, networkFilter, activeFilter, page, pageSize])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  // reset selection / page when tab changes
  useEffect(() => {
    setSelected(new Set())
    setPage(1)
    setNetworkFilter('')
    setPlanTypeFilter('')
    if (tab !== 'DATA' && view === 'matrix') setView('list')
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── client-side filters (search + planType) ─────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return plans.filter((p) => {
      if (q) {
        const blob = `${p.name} ${p.dataSize ?? ''} ${p.planType ?? ''} ${p.networkName ?? ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      if (tab === 'DATA' && planTypeFilter && (p.planType || '') !== planTypeFilter) return false
      return true
    })
  }, [plans, search, planTypeFilter, tab])

  // ── mutations (with optimistic update + toast undo) ─────────────────────
  const applyPatch = (id, patch) => setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const updatePlan = async (id, patch) => {
    const prev = plans.find((p) => p.id === id)
    applyPatch(id, patch)
    try {
      const res = await api.put(`/admin/vtu-plans/${id}`, patch)
      applyPatch(id, res.data.data || patch)
      toast.success('Saved')
    } catch (e) {
      if (prev) applyPatch(id, prev)
      toast.error(e.response?.data?.message || 'Save failed')
    }
  }

  const toggleActive = async (plan) => {
    const next = !plan.isActive
    const prev = plans.find((p) => p.id === plan.id)
    applyPatch(plan.id, { isActive: next })
    try {
      const res = await api.put(`/admin/vtu-plans/${plan.id}`, { isActive: next })
      applyPatch(plan.id, res.data.data || { isActive: next })
      toast.success(`${plan.name} ${next ? 'activated' : 'deactivated'}`)
    } catch (e) {
      if (prev) applyPatch(plan.id, prev)
      toast.error(e.response?.data?.message || 'Save failed')
    }
  }

  const inlineSetPrice = async (plan, newPrice) => {
    const value = Number(newPrice)
    if (!Number.isFinite(value) || value < 0) return toast.error('Invalid price')
    if (value === Number(plan.sellingPrice)) return
    if (value <= Number(plan.costPrice)) {
      setConfirm({
        title: 'Price below cost',
        message: `Selling price ${fmt(value)} is at or below cost ${fmt(plan.costPrice)}. Save anyway?`,
        tone: 'warn',
        onConfirm: () => updatePlan(plan.id, { sellingPrice: value }),
      })
      return
    }
    updatePlan(plan.id, { sellingPrice: value })
  }

  const deletePlan = (plan) => {
    // optimistic remove + toast Undo
    const snapshot = plans
    setPlans((prev) => prev.filter((p) => p.id !== plan.id))
    let undone = false
    toast(
      `Deleted "${plan.name}"`,
      {
        duration: UNDO_MS,
        action: { label: 'Undo', onClick: () => { undone = true; setPlans(snapshot) } },
      },
    )
    setTimeout(async () => {
      if (undone) return
      try { await api.delete(`/admin/vtu-plans/${plan.id}`) }
      catch (e) {
        setPlans(snapshot)
        toast.error(e.response?.data?.message || 'Delete failed - restored')
      }
    }, UNDO_MS)
  }

  // ── bulk ops ────────────────────────────────────────────────────────────
  const selectedPlans = useMemo(() => filtered.filter((p) => selected.has(p.id)), [filtered, selected])

  const clearSelection = () => setSelected(new Set())

  const bulkSetActive = async (isActive) => {
    const ids = [...selected]
    setPlans((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, isActive } : p)))
    const results = await Promise.allSettled(ids.map((id) => api.put(`/admin/vtu-plans/${id}`, { isActive })))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast.error(`${failed} of ${ids.length} failed`)
    else toast.success(`${ids.length} ${isActive ? 'activated' : 'deactivated'}`)
    clearSelection()
    fetchPlans()
  }

  const bulkDelete = () => {
    const ids = [...selected]
    setConfirm({
      title: `Delete ${ids.length} plan${ids.length > 1 ? 's' : ''}?`,
      message: 'This cannot be undone.',
      tone: 'danger',
      onConfirm: async () => {
        const results = await Promise.allSettled(ids.map((id) => api.delete(`/admin/vtu-plans/${id}`)))
        const failed = results.filter((r) => r.status === 'rejected').length
        if (failed) toast.error(`${failed} of ${ids.length} failed`)
        else toast.success(`${ids.length} deleted`)
        clearSelection()
        fetchPlans()
      },
    })
  }

  const bulkAdjustPrice = async (mode, value) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return
    const ids = [...selected]
    const updates = filtered
      .filter((p) => selected.has(p.id))
      .map((p) => {
        const next = mode === 'pct'
          ? Math.round(Number(p.sellingPrice) * (1 + v / 100) * 100) / 100
          : Math.round((Number(p.sellingPrice) + v) * 100) / 100
        return { id: p.id, sellingPrice: Math.max(0, next) }
      })
    setPlans((prev) => prev.map((p) => {
      const u = updates.find((x) => x.id === p.id)
      return u ? { ...p, sellingPrice: u.sellingPrice } : p
    }))
    const results = await Promise.allSettled(
      updates.map((u) => api.put(`/admin/vtu-plans/${u.id}`, { sellingPrice: u.sellingPrice })),
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed) toast.error(`${failed} of ${ids.length} failed`)
    else toast.success(`${ids.length} prices updated`)
    setBulkPriceOpen(false)
    clearSelection()
    fetchPlans()
  }

  // ── sheet open/close ────────────────────────────────────────────────────
  const openCreate = () => setSheet({ mode: 'create', plan: null })
  const openEdit = (plan) => setSheet({ mode: 'edit', plan })
  const closeSheet = () => setSheet(null)
  const onSheetSaved = () => { closeSheet(); fetchPlans() }

  const currentTab = TABS.find((t) => t.key === tab)
  const networks = networksByType[tab] || []

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">VTU Pricing</h1>
          <p className="text-sm text-muted dark:text-dark-muted mt-1">
            Manage AlRahuz networks, plans, and customer prices.
          </p>
        </div>
        <button onClick={openCreate} className={cls.btnPrimary}>
          <Plus size={16} />
          <span className="hidden xs:inline sm:inline">Add {currentTab?.label || 'Plan'}</span>
          <span className="xs:hidden sm:hidden">Add</span>
        </button>
      </div>

      {/* Tabs (horizontally scrollable on small screens) */}
      <div className="flex gap-1 mb-6 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 sm:gap-3 mb-4 lg:items-center">
        <div className="relative col-span-full lg:flex-1 lg:min-w-[220px] lg:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
          <input
            type="text"
            placeholder="Search plans…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${cls.input} pl-9`}
          />
        </div>

        <select
          value={networkFilter}
          onChange={(e) => { setNetworkFilter(e.target.value); setPage(1) }}
          className={`${cls.input} lg:w-44`}
        >
          <option value="">All networks</option>
          {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>

        {tab === 'DATA' && (
          <select
            value={planTypeFilter}
            onChange={(e) => setPlanTypeFilter(e.target.value)}
            className={`${cls.input} lg:w-40`}
          >
            <option value="">All types</option>
            {DATA_PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
          className={`${cls.input} lg:w-36`}
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {tab === 'DATA' && (
          <div className="col-span-full lg:ml-auto flex rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-hidden self-start">
            <button
              onClick={() => setView('list')}
              className={`flex-1 lg:flex-none px-3 py-2 text-sm flex items-center justify-center gap-1.5 ${view === 'list' ? 'bg-primary text-white' : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text'}`}
              title="List view"
            >
              <List size={14} /> List
            </button>
            <button
              onClick={() => setView('matrix')}
              className={`flex-1 lg:flex-none px-3 py-2 text-sm flex items-center justify-center gap-1.5 ${view === 'matrix' ? 'bg-primary text-white' : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text'}`}
              title="Matrix view"
            >
              <LayoutGrid size={14} /> Matrix
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={clearSelection}
          onActivate={() => bulkSetActive(true)}
          onDeactivate={() => bulkSetActive(false)}
          onAdjustPrice={() => setBulkPriceOpen(true)}
          onDelete={bulkDelete}
        />
      )}

      {/* Body */}
      {loading ? (
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted py-20 text-center text-muted dark:text-dark-muted">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState typeLabel={currentTab?.label} onAdd={openCreate} />
      ) : tab === 'DATA' && view === 'matrix' ? (
        <DataMatrix
          plans={filtered}
          networks={networks}
          onEditCell={(plan) => openEdit(plan)}
          onAddEmpty={(networkName, networkId, dataSize) => setSheet({
            mode: 'create',
            plan: { type: 'DATA', providerNetworkId: networkId, networkName, dataSize, planType: planTypeFilter || 'SME' },
          })}
          onInlinePrice={inlineSetPrice}
        />
      ) : (
        <ListView
          plans={filtered}
          tab={tab}
          selected={selected}
          setSelected={setSelected}
          onEdit={openEdit}
          onDelete={(p) => setConfirm({
            title: `Delete "${p.name}"?`,
            message: 'You can undo for a few seconds after.',
            tone: 'danger',
            onConfirm: () => deletePlan(p),
          })}
          onToggleActive={toggleActive}
          onInlinePrice={inlineSetPrice}
        />
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 text-sm">
          <div className="text-muted dark:text-dark-muted">
            {filtered.length} of {total} {filtered.length === 1 ? 'plan' : 'plans'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              className={`${cls.input} w-24 py-1.5`}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
            {total > pageSize && (
              <>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`${cls.btnGhost} disabled:opacity-40`}>
                  Prev
                </button>
                <span className="text-text dark:text-dark-text">{page} / {Math.ceil(total / pageSize)}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= total} className={`${cls.btnGhost} disabled:opacity-40`}>
                  Next
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Side sheet (form) */}
      {sheet && (
        <PlanSheet
          mode={sheet.mode}
          tab={tab}
          initial={sheet.plan}
          networksByType={networksByType}
          onClose={closeSheet}
          onSaved={onSheetSaved}
        />
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { confirm.onConfirm?.(); setConfirm(null) }}
        />
      )}

      {/* Bulk price dialog */}
      {bulkPriceOpen && (
        <BulkPriceDialog
          plans={selectedPlans}
          onCancel={() => setBulkPriceOpen(false)}
          onApply={bulkAdjustPrice}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Empty state
// ────────────────────────────────────────────────────────────────────────────

function EmptyState({ typeLabel, onAdd }) {
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-dashed border-surface-muted dark:border-dark-surface-muted py-16 text-center">
      <p className="text-text dark:text-dark-text font-medium mb-1">No {typeLabel?.toLowerCase()} plans yet</p>
      <p className="text-sm text-muted dark:text-dark-muted mb-6">Add your first plan to start selling.</p>
      <button onClick={onAdd} className={cls.btnPrimary + ' mx-auto'}>
        <Plus size={16} /> Add {typeLabel}
      </button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bulk action bar
// ────────────────────────────────────────────────────────────────────────────

function BulkBar({ count, onClear, onActivate, onDeactivate, onAdjustPrice, onDelete }) {
  return (
    <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-sm font-medium text-text dark:text-dark-text">{count} selected</span>
        <button onClick={onClear} className={`${cls.btnGhost} ml-auto sm:hidden`} title="Clear selection">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
        <button onClick={onActivate} className={cls.btnGhost}><Power size={14} /> Activate</button>
        <button onClick={onDeactivate} className={cls.btnGhost}><Power size={14} /> Deactivate</button>
        <button onClick={onAdjustPrice} className={cls.btnGhost}><Pencil size={14} /> Adjust price</button>
        <button onClick={onDelete} className={cls.btnDanger}><Trash2 size={14} /> Delete</button>
        <button onClick={onClear} className={`${cls.btnGhost} hidden sm:inline-flex`} title="Clear selection"><X size={14} /></button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// List view (table) - used for AIRTIME/CABLE/ELECTRICITY and Data list mode
// ────────────────────────────────────────────────────────────────────────────

function ListView({ plans, tab, selected, setSelected, onEdit, onDelete, onToggleActive, onInlinePrice }) {
  // group by network for visual scanability
  const groups = useMemo(() => {
    const g = new Map()
    for (const p of plans) {
      const k = p.networkName || '-'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(p)
    }
    for (const arr of g.values()) {
      arr.sort((a, b) => parseSizeToMB(a.dataSize) - parseSizeToMB(b.dataSize) || a.sortOrder - b.sortOrder)
    }
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [plans])

  const allIds = useMemo(() => plans.map((p) => p.id), [plans])
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-surface-muted dark:bg-dark-surface-muted">
          <tr className="text-left text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
            <th className="px-3 py-3 w-8">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 cursor-pointer" />
            </th>
            <th className="px-3 py-3">Plan</th>
            {tab === 'DATA' && <th className="px-3 py-3">Type</th>}
            <th className="px-3 py-3 text-right">Cost</th>
            <th className="px-3 py-3 text-right">Selling</th>
            <th className="px-3 py-3 text-right">Margin</th>
            <th className="px-3 py-3 text-center">Active</th>
            <th className="px-3 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {groups.map(([network, items]) => (
            <NetworkGroup
              key={network}
              network={network}
              items={items}
              tab={tab}
              selected={selected}
              toggleOne={toggleOne}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              onInlinePrice={onInlinePrice}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NetworkGroup({ network, items, tab, selected, toggleOne, onEdit, onDelete, onToggleActive, onInlinePrice }) {
  const [open, setOpen] = useState(true)
  const colSpan = tab === 'DATA' ? 8 : 7
  return (
    <>
      <tr className="bg-surface dark:bg-dark-surface border-t border-surface-muted dark:border-dark-surface-muted">
        <td colSpan={colSpan} className="px-3 py-2">
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-text dark:text-dark-text">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {network}
            <span className="text-muted dark:text-dark-muted font-normal">({items.length})</span>
          </button>
        </td>
      </tr>
      {open && items.map((p) => (
        <PlanRow
          key={p.id}
          plan={p}
          tab={tab}
          checked={selected.has(p.id)}
          onCheck={() => toggleOne(p.id)}
          onEdit={() => onEdit(p)}
          onDelete={() => onDelete(p)}
          onToggleActive={() => onToggleActive(p)}
          onInlinePrice={(v) => onInlinePrice(p, v)}
        />
      ))}
    </>
  )
}

function PlanRow({ plan, tab, checked, onCheck, onEdit, onDelete, onToggleActive, onInlinePrice }) {
  return (
    <tr className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/40 dark:hover:bg-dark-surface-muted/40">
      <td className="px-3 py-2.5">
        <input type="checkbox" checked={checked} onChange={onCheck} className="w-4 h-4 cursor-pointer" />
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-text dark:text-dark-text">{plan.name}</div>
        <div className="text-xs text-muted dark:text-dark-muted">
          {[plan.dataSize, plan.validity].filter(Boolean).join(' · ') || '-'}
        </div>
      </td>
      {tab === 'DATA' && (
        <td className="px-3 py-2.5">
          {plan.planType
            ? <span className={`${cls.pill} bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`}>{plan.planType}</span>
            : <span className="text-muted dark:text-dark-muted">-</span>}
        </td>
      )}
      <td className="px-3 py-2.5 text-right text-muted dark:text-dark-muted">{fmt(plan.costPrice)}</td>
      <td className="px-3 py-2.5 text-right">
        <InlinePrice value={plan.sellingPrice} onCommit={onInlinePrice} />
      </td>
      <td className="px-3 py-2.5 text-right">
        <MarginBadge cost={plan.costPrice} sell={plan.sellingPrice} />
      </td>
      <td className="px-3 py-2.5 text-center">
        <Toggle on={plan.isActive} onClick={onToggleActive} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-error/10 text-muted dark:text-dark-muted hover:text-error" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Inline editable price
// ────────────────────────────────────────────────────────────────────────────

function InlinePrice({ value, onCommit, compact }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(String(value ?? '')) }, [value, editing])
  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`font-semibold text-primary hover:underline ${compact ? 'text-sm' : ''}`}
        title="Click to edit"
      >
        {fmt(value)}
      </button>
    )
  }
  return (
    <input
      ref={inputRef}
      type="number"
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onCommit(draft) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { setEditing(false); onCommit(draft) }
        if (e.key === 'Escape') { setEditing(false); setDraft(String(value ?? '')) }
      }}
      className="w-24 border border-primary rounded px-2 py-1 text-sm text-right bg-surface dark:bg-dark-surface text-text dark:text-dark-text outline-none"
    />
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Margin badge
// ────────────────────────────────────────────────────────────────────────────

function MarginBadge({ cost, sell }) {
  const { naira, pct } = margin(cost, sell)
  const tone = marginTone(cost, sell)
  const palette = {
    ok:      'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    warn:    'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    bad:     'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    neutral: 'bg-surface-muted text-muted dark:bg-dark-surface-muted dark:text-dark-muted',
  }[tone]
  return (
    <span className={`${cls.pill} ${palette} font-semibold`} title={`${fmt(naira)} (${pct.toFixed(1)}%)`}>
      {tone === 'bad' && <AlertTriangle size={11} />}
      {naira >= 0 ? '+' : ''}{fmt(naira)} · {pct.toFixed(1)}%
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Active toggle
// ────────────────────────────────────────────────────────────────────────────

function Toggle({ on, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-5 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-surface-muted'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Data matrix (network × size)
// ────────────────────────────────────────────────────────────────────────────

function DataMatrix({ plans, networks, onEditCell, onAddEmpty, onInlinePrice }) {
  // Collect unique data sizes (sorted by MB), then bucket by network → size → first plan
  const sizes = useMemo(() => {
    const set = new Set()
    plans.forEach((p) => p.dataSize && set.add(p.dataSize))
    return [...set].sort((a, b) => parseSizeToMB(a) - parseSizeToMB(b))
  }, [plans])

  const grid = useMemo(() => {
    const m = {}
    for (const p of plans) {
      if (!p.dataSize || !p.networkName) continue
      m[p.networkName] = m[p.networkName] || {}
      // pick the cheapest plan if multiple match (simple deterministic rule)
      const existing = m[p.networkName][p.dataSize]
      if (!existing || Number(p.sellingPrice) < Number(existing.sellingPrice)) {
        m[p.networkName][p.dataSize] = p
      }
    }
    return m
  }, [plans])

  if (sizes.length === 0) {
    return (
      <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted p-12 text-center text-muted dark:text-dark-muted">
        No sized plans to display in matrix. Switch to List view or add data plans with sizes (e.g. "1GB").
      </div>
    )
  }

  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface dark:bg-dark-surface px-3 py-3 text-left text-xs uppercase tracking-wide text-muted dark:text-dark-muted border-b border-surface-muted dark:border-dark-surface-muted z-10">
              Network
            </th>
            {sizes.map((s) => (
              <th key={s} className="px-3 py-3 text-center text-xs uppercase tracking-wide text-muted dark:text-dark-muted border-b border-surface-muted dark:border-dark-surface-muted min-w-[120px]">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {networks.map((n) => {
            const row = grid[n.name] || {}
            return (
              <tr key={n.id} className="border-b border-surface-muted dark:border-dark-surface-muted">
                <td className="sticky left-0 bg-surface dark:bg-dark-surface px-3 py-2 font-semibold text-text dark:text-dark-text z-10">
                  {n.name}
                </td>
                {sizes.map((s) => {
                  const plan = row[s]
                  if (!plan) {
                    return (
                      <td key={s} className="px-2 py-2 align-top">
                        <button
                          onClick={() => onAddEmpty(n.name, n.id, s)}
                          className="w-full h-full min-h-[58px] rounded-lg border border-dashed border-surface-muted dark:border-dark-surface-muted text-muted dark:text-dark-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors text-xs"
                        >
                          + Add
                        </button>
                      </td>
                    )
                  }
                  return (
                    <td key={s} className={`px-2 py-2 align-top ${!plan.isActive ? 'opacity-50' : ''}`}>
                      <div
                        className="rounded-lg border border-surface-muted dark:border-dark-surface-muted p-2 hover:border-primary cursor-pointer transition-colors group"
                        onDoubleClick={() => onEditCell(plan)}
                        title="Double-click to edit details"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <InlinePrice value={plan.sellingPrice} onCommit={(v) => onInlinePrice(plan, v)} compact />
                          <MoreHorizontal
                            size={14}
                            className="opacity-0 group-hover:opacity-100 text-muted cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); onEditCell(plan) }}
                          />
                        </div>
                        <div className="text-[10px] text-muted dark:text-dark-muted">
                          cost {fmt(plan.costPrice)}
                        </div>
                        <div className="mt-1">
                          <MarginBadge cost={plan.costPrice} sell={plan.sellingPrice} />
                        </div>
                        {plan.planType && (
                          <div className="text-[10px] text-muted dark:text-dark-muted mt-1">{plan.planType}</div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Side sheet (form)
// ────────────────────────────────────────────────────────────────────────────

function PlanSheet({ mode, tab, initial, networksByType, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const startType = initial?.type || tab

  const [form, setForm] = useState({
    type: startType,
    providerNetworkId: initial?.providerNetworkId ?? '',
    networkName: initial?.networkName ?? '',
    providerPlanId: initial?.providerPlanId ?? '',
    name: initial?.name ?? '',
    dataSize: initial?.dataSize ?? '',
    validity: initial?.validity ?? '',
    planType: initial?.planType ?? (startType === 'DATA' ? 'SME' : ''),
    costPrice: initial?.costPrice ?? '',
    sellingPrice: initial?.sellingPrice ?? '',
    isActive: initial?.isActive ?? true,
    sortOrder: initial?.sortOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const networks = networksByType?.[form.type] || []

  // Auto-populate name for DATA when fields are present (only on create + when name is empty)
  useEffect(() => {
    if (isEdit) return
    if (form.type !== 'DATA') return
    if (form.name) return
    const parts = []
    if (form.dataSize) parts.push(form.dataSize)
    if (form.validity) parts.push(form.validity)
    if (parts.length) setField('name', parts.join(' · '))
  }, [form.dataSize, form.validity]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      type: form.type,
      providerNetworkId: form.providerNetworkId !== '' ? Number(form.providerNetworkId) : null,
      networkName: form.networkName || null,
      providerPlanId: form.providerPlanId !== '' ? Number(form.providerPlanId) : null,
      name: form.name,
      dataSize: form.dataSize || null,
      validity: form.validity || null,
      planType: form.planType || null,
      costPrice: Number(form.costPrice || 0),
      sellingPrice: Number(form.sellingPrice || 0),
      isActive: !!form.isActive,
      sortOrder: Number(form.sortOrder || 0),
    }
    try {
      if (isEdit) await api.put(`/admin/vtu-plans/${initial.id}`, payload)
      else        await api.post('/admin/vtu-plans', payload)
      toast.success(isEdit ? 'Plan updated' : 'Plan created')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // adaptive fields
  const showSizeValidity = form.type === 'DATA'
  const showPlanType     = form.type === 'DATA'
  const showProviderPlan = form.type === 'DATA' || form.type === 'CABLE'

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-surface dark:bg-dark-surface shadow-2xl border-l border-surface-muted dark:border-dark-surface-muted flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="text-lg font-bold text-text dark:text-dark-text">
            {isEdit ? `Edit ${TABS.find(t=>t.key===form.type)?.label || ''} plan` : `New ${TABS.find(t=>t.key===form.type)?.label || ''} plan`}
          </h2>
          <button onClick={onClose} className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* PRODUCT */}
          <Section title="Product">
            {!isEdit && (
              <div>
                <label className={cls.label}>Type</label>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-surface-muted dark:bg-dark-surface-muted">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setField('type', t.key)}
                      className={`py-1.5 text-xs font-medium rounded ${form.type === t.key ? 'bg-surface dark:bg-dark-surface text-primary shadow' : 'text-muted dark:text-dark-muted'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className={cls.label}>Network</label>
              <div className="flex flex-wrap gap-2">
                {networks.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, providerNetworkId: n.id, networkName: n.name }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      Number(form.providerNetworkId) === n.id
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
                    }`}
                  >
                    {n.name}
                  </button>
                ))}
              </div>
            </div>

            {showProviderPlan && (
              <div>
                <label className={cls.label}>Provider plan ID</label>
                <input
                  type="number"
                  value={form.providerPlanId}
                  onChange={(e) => setField('providerPlanId', e.target.value)}
                  className={cls.input}
                  placeholder="e.g. 206"
                />
              </div>
            )}
          </Section>

          {/* DISPLAY */}
          <Section title="Display">
            <div>
              <label className={cls.label}>Display name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className={cls.input}
                placeholder="e.g. 1GB · 30 Days"
              />
            </div>

            {showSizeValidity && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cls.label}>Data size</label>
                  <input value={form.dataSize} onChange={(e) => setField('dataSize', e.target.value)} className={cls.input} placeholder="1GB" />
                </div>
                <div>
                  <label className={cls.label}>Validity</label>
                  <input value={form.validity} onChange={(e) => setField('validity', e.target.value)} className={cls.input} placeholder="30 Days" />
                </div>
              </div>
            )}

            {showPlanType && (
              <div>
                <label className={cls.label}>Plan type</label>
                <select value={form.planType} onChange={(e) => setField('planType', e.target.value)} className={cls.input}>
                  <option value="">-</option>
                  {DATA_PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </Section>

          {/* PRICING */}
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cls.label}>Cost (₦) *</label>
                <NumberInput decimal required value={form.costPrice} onChange={(val) => setField('costPrice', val)} className={cls.input} placeholder="AlRahuz price" />
              </div>
              <div>
                <label className={cls.label}>Selling (₦) *</label>
                <NumberInput decimal required value={form.sellingPrice} onChange={(val) => setField('sellingPrice', val)} className={cls.input} placeholder="Customer price" />
              </div>
            </div>
            <div className="rounded-lg bg-surface-muted dark:bg-dark-surface-muted p-3 flex items-center justify-between">
              <span className="text-xs text-muted dark:text-dark-muted">Live margin</span>
              <MarginBadge cost={form.costPrice} sell={form.sellingPrice} />
            </div>
          </Section>

          {/* SETTINGS */}
          <Section title="Settings">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cls.label}>Sort order</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setField('sortOrder', e.target.value)} className={cls.input} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm font-medium text-text dark:text-dark-text">Active</span>
                </label>
              </div>
            </div>
          </Section>
        </form>

        <div className="px-5 py-4 border-t border-surface-muted dark:border-dark-surface-muted flex gap-2">
          <button type="button" onClick={onClose} className={`${cls.btnGhost} flex-1 justify-center border border-surface-muted dark:border-dark-surface-muted`}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className={`${cls.btnPrimary} flex-1 justify-center`}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted dark:text-dark-muted mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Confirm dialog
// ────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, tone = 'default', onCancel, onConfirm, confirmLabel }) {
  const accent = tone === 'danger' ? 'bg-error hover:bg-error/90' : tone === 'warn' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary-700'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-surface dark:bg-dark-surface rounded-xl shadow-xl border border-surface-muted dark:border-dark-surface-muted w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          {tone !== 'default' && (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tone === 'danger' ? 'bg-error/10 text-error' : 'bg-amber-500/10 text-amber-600'}`}>
              <AlertTriangle size={20} />
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-text dark:text-dark-text">{title}</h3>
            {message && <p className="text-sm text-muted dark:text-dark-muted mt-1">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className={`${cls.btnGhost} border border-surface-muted dark:border-dark-surface-muted`}>Cancel</button>
          <button onClick={onConfirm} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${accent}`}>
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bulk price dialog (preview + apply)
// ────────────────────────────────────────────────────────────────────────────

function BulkPriceDialog({ plans, onCancel, onApply }) {
  const [mode, setMode] = useState('pct')
  const [value, setValue] = useState('')

  const v = Number(value)
  const valid = Number.isFinite(v)
  const previewRows = plans.slice(0, 5).map((p) => {
    const next = mode === 'pct'
      ? Math.round(Number(p.sellingPrice) * (1 + v / 100) * 100) / 100
      : Math.round((Number(p.sellingPrice) + v) * 100) / 100
    return { ...p, next: Math.max(0, next) }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-surface dark:bg-dark-surface rounded-xl shadow-xl border border-surface-muted dark:border-dark-surface-muted w-full max-w-lg p-6">
        <h3 className="text-lg font-bold text-text dark:text-dark-text mb-1">Adjust price for {plans.length} plan{plans.length > 1 ? 's' : ''}</h3>
        <p className="text-sm text-muted dark:text-dark-muted mb-4">Apply a percentage or flat-naira change to selling price.</p>

        <div className="flex rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-hidden mb-3 w-fit">
          <button onClick={() => setMode('pct')} className={`px-4 py-2 text-sm font-medium ${mode === 'pct' ? 'bg-primary text-white' : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text'}`}>Percentage</button>
          <button onClick={() => setMode('flat')} className={`px-4 py-2 text-sm font-medium ${mode === 'flat' ? 'bg-primary text-white' : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text'}`}>Flat ₦</button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${cls.input} flex-1`}
            placeholder={mode === 'pct' ? 'e.g. 5 for +5%, -3 for -3%' : 'e.g. 10 for +₦10'}
          />
          <span className="text-muted dark:text-dark-muted text-sm">{mode === 'pct' ? '%' : '₦'}</span>
        </div>

        {valid && (
          <div className="rounded-lg border border-surface-muted dark:border-dark-surface-muted overflow-hidden mb-4">
            <div className="text-xs uppercase tracking-wide text-muted dark:text-dark-muted px-3 py-2 bg-surface-muted dark:bg-dark-surface-muted">
              Preview ({Math.min(5, plans.length)} of {plans.length})
            </div>
            <table className="w-full text-sm">
              <tbody>
                {previewRows.map((p) => (
                  <tr key={p.id} className="border-t border-surface-muted dark:border-dark-surface-muted">
                    <td className="px-3 py-2 text-text dark:text-dark-text">{p.networkName} {p.name}</td>
                    <td className="px-3 py-2 text-right text-muted dark:text-dark-muted">{fmt(p.sellingPrice)}</td>
                    <td className="px-3 py-2 text-center text-muted dark:text-dark-muted">→</td>
                    <td className={`px-3 py-2 text-right font-semibold ${p.next < Number(p.costPrice) ? 'text-error' : 'text-primary'}`}>{fmt(p.next)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className={`${cls.btnGhost} border border-surface-muted dark:border-dark-surface-muted`}>Cancel</button>
          <button
            onClick={() => onApply(mode, v)}
            disabled={!valid}
            className={`${cls.btnPrimary} disabled:opacity-50`}
          >
            <Check size={14} /> Apply to {plans.length}
          </button>
        </div>
      </div>
    </div>
  )
}
