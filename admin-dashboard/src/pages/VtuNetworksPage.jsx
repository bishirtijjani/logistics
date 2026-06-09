import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, X, Smartphone, Wifi, Tv, Zap, AlertTriangle,
} from 'lucide-react'
import api from '../lib/api'

const TABS = [
  { key: 'AIRTIME',     label: 'Airtime networks', icon: Smartphone },
  { key: 'DATA',        label: 'Data networks',    icon: Wifi },
  { key: 'CABLE',       label: 'Cable names',      icon: Tv },
  { key: 'ELECTRICITY', label: 'Discos',           icon: Zap },
]

const cls = {
  input: 'w-full border border-surface-muted dark:border-dark-surface-muted rounded-lg px-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text placeholder:text-muted dark:placeholder:text-dark-muted outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  label: 'block text-xs font-semibold text-muted dark:text-dark-muted mb-1 uppercase tracking-wide',
  btnPrimary: 'inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors',
  btnGhost: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors',
}

export default function VtuNetworksPage() {
  const [tab, setTab] = useState('AIRTIME')
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null)        // { mode, network? } | null
  const [confirm, setConfirm] = useState(null)    // { title, message, tone, onConfirm } | null

  const fetchNetworks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/vtu-networks')
      setNetworks(res.data.data || [])
    } catch {
      toast.error('Failed to load networks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNetworks() }, [fetchNetworks])

  const visible = useMemo(
    () => networks.filter((n) => n.type === tab).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [networks, tab],
  )

  const openCreate = () => setSheet({ mode: 'create', network: { type: tab } })
  const openEdit = (network) => setSheet({ mode: 'edit', network })

  const toggleActive = async (network) => {
    const prev = networks
    const next = !network.isActive
    setNetworks((arr) => arr.map((n) => (n.id === network.id ? { ...n, isActive: next } : n)))
    try {
      await api.put(`/admin/vtu-networks/${network.id}`, { isActive: next })
      toast.success(`${network.name} ${next ? 'activated' : 'deactivated'}`)
    } catch (e) {
      setNetworks(prev)
      toast.error(e.response?.data?.message || 'Update failed')
    }
  }

  const requestDelete = (network) => {
    setConfirm({
      title: `Delete "${network.name}"?`,
      message: 'Plans still pointing at this network will block the delete.',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/vtu-networks/${network.id}`)
          setNetworks((arr) => arr.filter((n) => n.id !== network.id))
          toast.success('Network deleted')
        } catch (e) {
          toast.error(e.response?.data?.message || 'Delete failed')
        }
      },
    })
  }

  const currentTab = TABS.find((t) => t.key === tab)
  const Icon = currentTab?.icon

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">VTU Networks</h1>
          <p className="text-sm text-muted dark:text-dark-muted mt-1 max-w-2xl">
            The provider IDs (network, disco, cable) sent to the upstream VTU
            provider. Edit these here when the provider renumbers an ID - every
            plan referencing this network is updated automatically.
          </p>
        </div>
        <button onClick={openCreate} className={cls.btnPrimary}>
          <Plus size={16} />
          <span>Add {currentTab?.label.replace(/s$/, '').toLowerCase()}</span>
        </button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-surface-muted dark:border-dark-surface-muted overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const TabIcon = t.icon
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
              <TabIcon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted py-20 text-center text-muted dark:text-dark-muted">
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-dashed border-surface-muted dark:border-dark-surface-muted py-16 text-center">
          {Icon ? <Icon size={32} className="mx-auto text-muted dark:text-dark-muted mb-3" /> : null}
          <p className="text-text dark:text-dark-text font-medium mb-1">No {currentTab?.label.toLowerCase()} yet</p>
          <p className="text-sm text-muted dark:text-dark-muted mb-6">Add the first entry to start mapping provider IDs.</p>
          <button onClick={openCreate} className={cls.btnPrimary + ' mx-auto'}>
            <Plus size={16} /> Add
          </button>
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted">
              <tr className="text-left text-xs uppercase tracking-wide text-muted dark:text-dark-muted">
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3 text-right">Provider ID</th>
                <th className="px-3 py-3 text-right">Sort order</th>
                <th className="px-3 py-3 text-center">Active</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {visible.map((n) => (
                <tr key={n.id} className="border-t border-surface-muted dark:border-dark-surface-muted hover:bg-surface-muted/40 dark:hover:bg-dark-surface-muted/40">
                  <td className="px-3 py-2.5 font-medium text-text dark:text-dark-text">{n.name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-text dark:text-dark-text">{n.providerNetworkId}</td>
                  <td className="px-3 py-2.5 text-right text-muted dark:text-dark-muted">{n.sortOrder}</td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => toggleActive(n)}
                      className={`w-10 h-5 rounded-full transition-colors ${n.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-dark-surface-muted'}`}
                      role="switch"
                      aria-checked={n.isActive}
                      title={n.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${n.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(n)} className="p-1.5 rounded hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => requestDelete(n)} className="p-1.5 rounded hover:bg-error/10 text-muted dark:text-dark-muted hover:text-error" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sheet && (
        <NetworkSheet
          mode={sheet.mode}
          initial={sheet.network}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); fetchNetworks() }}
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

function NetworkSheet({ mode, initial, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState({
    type: initial?.type || 'AIRTIME',
    providerNetworkId: initial?.providerNetworkId ?? '',
    name: initial?.name ?? '',
    sortOrder: initial?.sortOrder ?? 0,
    isActive: initial?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      type: form.type,
      providerNetworkId: Number(form.providerNetworkId),
      name: form.name.trim(),
      sortOrder: Number(form.sortOrder || 0),
      isActive: !!form.isActive,
    }
    try {
      if (isEdit) await api.put(`/admin/vtu-networks/${initial.id}`, payload)
      else        await api.post('/admin/vtu-networks', payload)
      toast.success(isEdit ? 'Network updated' : 'Network created')
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
      <div className="relative w-full sm:max-w-md bg-surface dark:bg-dark-surface shadow-2xl border-l border-surface-muted dark:border-dark-surface-muted flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="text-lg font-bold text-text dark:text-dark-text">
            {isEdit ? 'Edit network' : 'New network'}
          </h2>
          <button onClick={onClose} className="text-muted dark:text-dark-muted hover:text-text dark:hover:text-dark-text">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={cls.label}>Type</label>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-surface-muted dark:bg-dark-surface-muted">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => !isEdit && setField('type', t.key)}
                  disabled={isEdit}
                  className={`py-1.5 text-xs font-medium rounded ${
                    form.type === t.key ? 'bg-surface dark:bg-dark-surface text-primary shadow' : 'text-muted dark:text-dark-muted'
                  } ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
                  title={isEdit ? 'Type is immutable - delete and recreate to change' : undefined}
                >
                  {t.key}
                </button>
              ))}
            </div>
            {isEdit && (
              <p className="text-xs text-muted dark:text-dark-muted mt-1">Type cannot be changed after creation.</p>
            )}
          </div>

          <div>
            <label className={cls.label}>Display name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className={cls.input}
              placeholder="e.g. MTN, DSTV, Ikeja"
            />
          </div>

          <div>
            <label className={cls.label}>Provider ID *</label>
            <input
              required
              type="number"
              value={form.providerNetworkId}
              onChange={(e) => setField('providerNetworkId', e.target.value)}
              className={cls.input}
              placeholder="e.g. 1"
            />
            <p className="text-xs text-muted dark:text-dark-muted mt-1">
              The integer the upstream VTU provider expects in API calls (network, disco_name, cablename).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setField('sortOrder', e.target.value)}
                className={cls.input}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-text dark:text-dark-text">Active</span>
              </label>
            </div>
          </div>

          {isEdit && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                Changing the provider ID will update every plan that references this network so customer purchases stay routable.
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
