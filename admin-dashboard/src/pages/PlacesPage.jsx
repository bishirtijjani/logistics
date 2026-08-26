import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus, Search, Pencil, Trash2, X, MapPin, AlertTriangle, Building2,
} from 'lucide-react'
import api from '../lib/api'
import LocationPicker from '../components/LocationPicker.jsx'

const TYPE_OPTIONS = [
  'Faculty', 'Hostel', 'Gate', 'Office', 'Library', 'Market', 'Shop',
  'Village', 'Neighbourhood',
]

const cls = {
  input: 'w-full border border-surface-muted dark:border-dark-surface-muted rounded-lg px-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text placeholder:text-muted dark:placeholder:text-dark-muted outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  label: 'block text-xs font-semibold text-muted dark:text-dark-muted mb-1 uppercase tracking-wide',
  btnPrimary: 'inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors',
  btnGhost: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors',
}

export default function PlacesPage() {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'true' | 'false'
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 50

  const [sheet, setSheet] = useState(null)     // { mode, place? } | null
  const [confirm, setConfirm] = useState(null) // { title, message, tone, onConfirm } | null

  const fetchPlaces = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: pageSize })
      if (search.trim()) params.set('search', search.trim())
      if (activeFilter !== 'all') params.set('isActive', activeFilter)
      const res = await api.get(`/admin/places?${params}`)
      // The list endpoint uses ApiResponse.paginated: the array lives in
      // `data` directly and the count in `meta.total` (not `data.items`).
      const payload = res.data?.data
      setPlaces(Array.isArray(payload) ? payload : [])
      setTotal(res.data?.meta?.total || 0)
    } catch {
      toast.error('Failed to load places')
    } finally {
      setLoading(false)
    }
  }, [page, search, activeFilter])

  useEffect(() => { fetchPlaces() }, [fetchPlaces])

  // Debounce the search box so we don't fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const openCreate = () => setSheet({ mode: 'create' })
  const openEdit = (place) => setSheet({ mode: 'edit', place })

  const toggleActive = async (place) => {
    const prev = places
    const next = !place.isActive
    setPlaces((arr) => arr.map((p) => (p.id === place.id ? { ...p, isActive: next } : p)))
    try {
      await api.put(`/admin/places/${place.id}`, { isActive: next })
      toast.success(`${place.name} ${next ? 'activated' : 'deactivated'}`)
    } catch (e) {
      setPlaces(prev)
      toast.error(e.response?.data?.message || 'Update failed')
    }
  }

  const requestDelete = (place) => {
    setConfirm({
      title: `Delete "${place.name}"?`,
      message: 'It will disappear from search and from the maps immediately. Completed deliveries keep their stored address.',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/places/${place.id}`)
          setPlaces((arr) => arr.filter((p) => p.id !== place.id))
          toast.success('Place deleted')
        } catch (e) {
          toast.error(e.response?.data?.message || 'Delete failed')
        }
      },
    })
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Places</h1>
          <p className="text-sm text-muted dark:text-dark-muted mt-1 max-w-2xl">
            Locations Google doesn't know about (campus buildings, estates, market stalls,
            villages). Drop a pin on the map, name it, and it appears in customer and rider
            search — and as a label on their maps — exactly like a native Google place.
          </p>
        </div>
        <button onClick={openCreate} className={cls.btnPrimary}>
          <Plus size={16} />
          <span>Add location</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-dark-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or alias (e.g. “Faculty of Law” or “SBS”)…"
            className={`${cls.input} pl-10`}
          />
        </div>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1) }}
          className={`${cls.input} sm:w-44`}
        >
          <option value="all">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Deactivated only</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted py-20 text-center text-muted dark:text-dark-muted">
          Loading…
        </div>
      ) : places.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-dashed border-surface-muted dark:border-dark-surface-muted py-16 text-center">
          <Building2 size={32} className="mx-auto text-muted dark:text-dark-muted mb-3" />
          <p className="text-text dark:text-dark-text font-medium mb-1">No custom places yet</p>
          <p className="text-sm text-muted dark:text-dark-muted mb-6">Add the first one — e.g. every faculty and hostel on the UMYU campus.</p>
          <button onClick={openCreate} className={cls.btnPrimary + ' mx-auto'}>
            <Plus size={16} /> Add location
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface-muted dark:bg-dark-surface-muted">
                <tr className="text-left text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Coordinates</th>
                  <th className="px-3 py-3 text-center">Active</th>
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {places.map((p) => (
                  <tr key={p.id} className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/40 dark:hover:bg-dark-surface-muted/40">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-text dark:text-dark-text">{p.name}</div>
                      {p.aliases?.length > 0 && (
                        <div className="text-xs text-muted dark:text-dark-muted mt-0.5">
                          {p.aliases.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.type ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text">
                          {p.type}
                        </span>
                      ) : (
                        <span className="text-muted dark:text-dark-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted dark:text-dark-muted">
                      {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleActive(p)}
                        className={`w-10 h-5 rounded-full transition-colors ${p.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-surface-muted'}`}
                        role="switch"
                        aria-checked={p.isActive}
                        title={p.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${p.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => requestDelete(p)} className="p-1.5 rounded hover:bg-error/10 text-muted dark:text-dark-muted hover:text-error" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted dark:text-dark-muted">
              <span>
                Showing {Math.min(page * pageSize, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={cls.btnGhost + ' border border-surface-muted dark:border-dark-surface-muted disabled:opacity-40'}>
                  Prev
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= total} className={cls.btnGhost + ' border border-surface-muted dark:border-dark-surface-muted disabled:opacity-40'}>
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {sheet && (
        <PlaceSheet
          mode={sheet.mode}
          initial={sheet.place}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); fetchPlaces() }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          {...confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { confirm.onConfirm?.(); setConfirm(null) }}
        />
      )}
    </div>
  )
}

function PlaceSheet({ mode, initial, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    aliases: initial?.aliases?.join(', ') ?? '',
    type: initial?.type ?? '',
    lga: initial?.lga ?? '',
    address: initial?.address ?? '',
    description: initial?.description ?? '',
    isActive: initial?.isActive ?? true,
  })
  const [location, setLocation] = useState(() => ({
    address: initial?.address ?? '',
    lat: initial?.lat ?? 0,
    lng: initial?.lng ?? 0,
  }))
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (location.lat === 0 && location.lng === 0) {
      toast.error('Drop a pin on the map first')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      aliases: form.aliases.split(',').map((s) => s.trim()).filter(Boolean),
      type: form.type.trim() || null,
      lga: form.lga.trim() || null,
      address: (form.address.trim() || location.address || null),
      description: form.description.trim() || null,
      lat: location.lat,
      lng: location.lng,
      isActive: !!form.isActive,
    }
    try {
      if (isEdit) await api.put(`/admin/places/${initial.id}`, payload)
      else        await api.post('/admin/places', payload)
      toast.success(isEdit ? 'Place updated' : 'Place created')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-surface dark:bg-dark-surface shadow-2xl border-l border-surface-muted dark:border-dark-surface-muted flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="text-lg font-bold text-text dark:text-dark-text">
            {isEdit ? 'Edit location' : 'Add location'}
          </h2>
          <button onClick={onClose} className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={cls.label}>Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className={cls.input}
              placeholder="e.g. Faculty of Law, UMYU"
            />
            <p className="text-xs text-muted dark:text-dark-muted mt-1">
              The name customers and riders will see in search and on the map.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Type</label>
              <input
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                className={cls.input}
                placeholder="e.g. Faculty"
                list="custom-place-types"
              />
              <datalist id="custom-place-types">
                {TYPE_OPTIONS.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label className={cls.label}>LGA</label>
              <input
                value={form.lga}
                onChange={(e) => setField('lga', e.target.value)}
                className={cls.input}
                placeholder="e.g. Katsina"
              />
            </div>
          </div>

          <div>
            <label className={cls.label}>Aliases (comma separated)</label>
            <input
              value={form.aliases}
              onChange={(e) => setField('aliases', e.target.value)}
              className={cls.input}
              placeholder="e.g. Law Faculty, SBS, New Hostel"
            />
            <p className="text-xs text-muted dark:text-dark-muted mt-1">
              Extra words people might type — Hausa names, faculty codes, shorthand.
            </p>
          </div>

          <div>
            <label className={cls.label}>Location *</label>
            <LocationPicker
              value={location}
              onChange={(loc) => {
                setLocation(loc)
                // Auto-fill the address field from the pin unless the admin has
                // already typed a custom one.
                setForm((f) => ({ ...f, address: f.address.trim() ? f.address : loc.address }))
              }}
            />
          </div>

          <div>
            <label className={cls.label}>Address (override)</label>
            <input
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              className={cls.input}
              placeholder="Auto-filled from the map — override if unclear"
            />
          </div>

          <div>
            <label className={cls.label}>Rider note (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className={`${cls.input} min-h-[70px] resize-y`}
              placeholder="e.g. Main gate side, opposite the library"
            />
            <p className="text-xs text-muted dark:text-dark-muted mt-1">
              Shown to riders so they can find the spot when there's no street label.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-text dark:text-dark-text">Active (visible in search and on maps)</span>
          </label>

          {isEdit && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                Changes go live immediately for all customers and riders. Use the
                Active toggle (not delete) to temporarily hide a location.
              </span>
            </div>
          )}
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

function ConfirmDialog({ title, message, tone = 'default', onCancel, onConfirm, confirmLabel }) {
  const accent = tone === 'danger' ? 'bg-error hover:bg-error/90' : tone === 'warn' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary-700'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-xl shadow-xl border border-surface-muted dark:border-dark-surface-muted w-full sm:max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
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
