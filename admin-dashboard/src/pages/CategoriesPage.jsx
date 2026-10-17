import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { SlidersHorizontal, Pencil, Ban, Trash2, LayoutGrid } from 'lucide-react'
import ActionMenu from '../components/ActionMenu'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryAttributeSchema,
} from '../store/slices/categoriesSlice'

const PACK_UNITS = ['ML','L','G','KG','TABLET','CAPSULE','PIECE','PAIR','PACK','BOTTLE','SACHET','CARTON']
const AXIS_SUGGESTIONS = ['size','color','strength','form','capacity','flavor']

// Curated allowlist of MaterialCommunityIcons names that exist in the customer app
// (mobile/customer-app uses @expo/vector-icons MaterialCommunityIcons set).
// Adding new icons here: confirm the name renders in MaterialCommunityIcons
// at https://icons.expo.fyi before listing it.
const ICON_OPTIONS = [
  { name: 'restaurant', label: 'Food / Restaurant' },
  { name: 'silverware-fork-knife', label: 'Dining' },
  { name: 'basket', label: 'Grocery' },
  { name: 'cart', label: 'Cart' },
  { name: 'pill', label: 'Pharmacy / Medicine' },
  { name: 'medical-bag', label: 'Health' },
  { name: 'tshirt-crew', label: 'Clothing' },
  { name: 'hanger', label: 'Apparel' },
  { name: 'shoe-formal', label: 'Footwear' },
  { name: 'cellphone', label: 'Electronics' },
  { name: 'laptop', label: 'Computers' },
  { name: 'flower', label: 'Florist' },
  { name: 'gift', label: 'Gifts' },
  { name: 'book-open-page-variant', label: 'Books' },
  { name: 'tools', label: 'Hardware' },
  { name: 'spray-bottle', label: 'Cleaning / Beauty' },
  { name: 'hair-dryer', label: 'Salon / Beauty' },
  { name: 'baby-carriage', label: 'Baby' },
  { name: 'paw', label: 'Pet supplies' },
  { name: 'washing-machine', label: 'Laundry' },
  { name: 'cake-variant', label: 'Bakery' },
  { name: 'coffee', label: 'Cafe' },
  { name: 'food-apple', label: 'Produce' },
  { name: 'water', label: 'Water / Beverages' },
  { name: 'store', label: 'General store' },
]

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  icon: 'store',
  color: '#7C3AED',
  sortOrder: 0,
  hasPreparation: true,
  isActive: true,
}

const inputCls =
  'w-full border border-surface-muted dark:border-dark-surface-muted rounded-lg px-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text placeholder:text-muted dark:placeholder:text-dark-muted outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
const labelCls = 'block text-xs font-semibold text-muted dark:text-dark-muted mb-1'

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export default function CategoriesPage() {
  const dispatch = useDispatch()
  const { list: categories, loading } = useSelector((s) => s.categories)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [attrTarget, setAttrTarget] = useState(null) // category being edited for attributeSchema
  const [attrSchema, setAttrSchema] = useState({ axes: [], pack: false, packUnits: [] })
  const [attrRaw, setAttrRaw] = useState('')
  const [attrMode, setAttrMode] = useState('builder') // 'builder' | 'json'
  const [attrError, setAttrError] = useState(null)
  const [attrSaving, setAttrSaving] = useState(false)

  useEffect(() => {
    dispatch(fetchCategories({ limit: 200 }))
  }, [dispatch])

  const visible = showInactive ? categories : categories.filter((c) => c.isActive)

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (cat) => {
    setEditingId(cat.id)
    setForm({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      icon: cat.icon || '',
      color: cat.color || '#7C3AED',
      sortOrder: cat.sortOrder ?? 0,
      hasPreparation: cat.hasPreparation,
      isActive: cat.isActive,
    })
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug?.trim() || slugify(form.name),
        description: form.description?.trim() || undefined,
        icon: form.icon?.trim() || undefined,
        color: form.color || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        hasPreparation: !!form.hasPreparation,
      }
      if (editingId) {
        payload.isActive = !!form.isActive
        await dispatch(updateCategory({ categoryId: editingId, ...payload })).unwrap()
        toast.success('Category updated')
      } else {
        await dispatch(createCategory(payload)).unwrap()
        toast.success('Category created')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const openAttrEditor = (cat) => {
    const schema = cat.attributeSchema || { axes: [], pack: false, packUnits: [] }
    setAttrTarget(cat)
    setAttrSchema({
      axes: Array.isArray(schema.axes) ? [...schema.axes] : [],
      pack: !!schema.pack,
      packUnits: Array.isArray(schema.packUnits) ? [...schema.packUnits] : [],
      ...(schema.sizeSystem ? { sizeSystem: schema.sizeSystem } : {}),
    })
    setAttrRaw(JSON.stringify(schema, null, 2))
    setAttrMode('builder')
    setAttrError(null)
  }

  const closeAttrEditor = () => {
    setAttrTarget(null)
    setAttrError(null)
  }

  const toggleAxis = (axis) => {
    setAttrSchema((s) => ({
      ...s,
      axes: s.axes.includes(axis) ? s.axes.filter((a) => a !== axis) : [...s.axes, axis],
    }))
  }

  const togglePackUnit = (unit) => {
    setAttrSchema((s) => ({
      ...s,
      packUnits: s.packUnits.includes(unit)
        ? s.packUnits.filter((u) => u !== unit)
        : [...s.packUnits, unit],
    }))
  }

  const saveAttrSchema = async () => {
    let toSave = attrSchema
    if (attrMode === 'json') {
      try {
        const parsed = attrRaw.trim() ? JSON.parse(attrRaw) : null
        toSave = parsed
      } catch (err) {
        setAttrError('Invalid JSON: ' + err.message)
        return
      }
    }
    setAttrSaving(true)
    setAttrError(null)
    try {
      await dispatch(
        updateCategoryAttributeSchema({ categoryId: attrTarget.id, attributeSchema: toSave })
      ).unwrap()
      toast.success('Attribute schema saved')
      closeAttrEditor()
    } catch (err) {
      setAttrError(err?.message || 'Save failed')
    } finally {
      setAttrSaving(false)
    }
  }

  const remove = async (cat) => {
    const merchantCount = cat._count?.merchants ?? 0
    const msg =
      merchantCount > 0
        ? `Deactivate "${cat.name}"? It's still assigned to ${merchantCount} merchant(s) - they keep working but the category disappears from new signups.`
        : `Delete "${cat.name}" permanently? Zero merchants reference it.`
    if (!confirm(msg)) return
    try {
      await dispatch(deleteCategory(cat.id)).unwrap()
      toast.success(merchantCount > 0 ? 'Category deactivated' : 'Category deleted')
    } catch (err) {
      toast.error(err?.message || 'Delete failed')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-dark-text">Merchant Categories</h1>
          <p className="text-sm text-muted dark:text-dark-muted mt-1">
            Admin-managed list of business types. New categories appear immediately in the customer app and merchant signup.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
          <Link
            to="/home-categories"
            className="inline-flex items-center gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg text-sm font-medium text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted w-full sm:w-auto justify-center"
          >
            <LayoutGrid className="h-4 w-4" />
            Home layout
          </Link>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors w-full sm:w-auto"
          >
            + New Category
          </button>
        </div>
      </div>

      <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted overflow-x-auto">
        {loading && categories.length === 0 ? (
          <div className="p-8 text-center text-muted dark:text-dark-muted">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-muted dark:text-dark-muted">No categories</div>
        ) : (
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-surface-muted dark:bg-dark-surface-muted text-left text-xs uppercase text-muted dark:text-dark-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Icon</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Prep</th>
                <th className="px-4 py-3">Merchants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-t border-surface-muted dark:border-dark-surface-muted"
                >
                  <td className="px-4 py-3 font-medium text-text dark:text-dark-text">
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-muted dark:text-dark-muted font-mono text-xs">
                    {cat.slug}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded border border-surface-muted dark:border-dark-surface-muted"
                        style={{ background: cat.color || '#999' }}
                      />
                      <span className="text-xs text-muted dark:text-dark-muted">
                        {cat.color || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted">
                    {cat.icon ? (
                      <span title={ICON_OPTIONS.find((o) => o.name === cat.icon)?.label || cat.icon}>
                        {cat.icon}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-text dark:text-dark-text">{cat.sortOrder}</td>
                  <td className="px-4 py-3 text-text dark:text-dark-text">
                    {cat.hasPreparation ? 'Yes' : 'No'}
                  </td>
                  <td className="px-4 py-3 text-text dark:text-dark-text">
                    {cat._count?.merchants ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        cat.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ActionMenu
                        actions={[
                          {
                            label: 'Attributes',
                            icon: SlidersHorizontal,
                            onClick: () => openAttrEditor(cat),
                            title: 'Edit attribute schema (axes & pack units)',
                          },
                          {
                            label: 'Edit',
                            icon: Pencil,
                            onClick: () => openEdit(cat),
                          },
                          {
                            label: (cat._count?.merchants ?? 0) > 0 ? 'Deactivate' : 'Delete',
                            icon: (cat._count?.merchants ?? 0) > 0 ? Ban : Trash2,
                            danger: true,
                            onClick: () => remove(cat),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {attrTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text dark:text-dark-text">
                  Attribute Schema - {attrTarget.name}
                </h2>
                <p className="text-xs text-muted dark:text-dark-muted">
                  Tells the merchant product form which axes & pack inputs to render. UX hint only - DB does not enforce.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAttrMode('builder')}
                  className={`text-xs px-2 py-1 rounded ${attrMode === 'builder' ? 'bg-primary text-white' : 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'}`}
                >
                  Builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttrRaw(JSON.stringify(attrSchema, null, 2))
                    setAttrMode('json')
                  }}
                  className={`text-xs px-2 py-1 rounded ${attrMode === 'json' ? 'bg-primary text-white' : 'bg-surface-muted dark:bg-dark-surface-muted text-text dark:text-dark-text'}`}
                >
                  JSON
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {attrMode === 'builder' ? (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Axes</label>
                      <div className="flex flex-wrap gap-2">
                        {AXIS_SUGGESTIONS.map((axis) => (
                          <button
                            key={axis}
                            type="button"
                            onClick={() => toggleAxis(axis)}
                            className={`text-xs px-3 py-1 rounded-full border ${
                              attrSchema.axes.includes(axis)
                                ? 'bg-primary text-white border-primary'
                                : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted'
                            }`}
                          >
                            {axis}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted dark:text-dark-muted mt-1">
                        Click to toggle. Custom axis names: switch to JSON mode.
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
                        <input
                          type="checkbox"
                          checked={!!attrSchema.pack}
                          onChange={(e) =>
                            setAttrSchema((s) => ({ ...s, pack: e.target.checked }))
                          }
                        />
                        Show pack size + pack unit inputs
                      </label>
                    </div>

                    {attrSchema.pack && (
                      <div>
                        <label className={labelCls}>Pack units</label>
                        <div className="flex flex-wrap gap-2">
                          {PACK_UNITS.map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => togglePackUnit(u)}
                              className={`text-xs px-3 py-1 rounded-full border ${
                                attrSchema.packUnits.includes(u)
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-surface dark:bg-dark-surface text-text dark:text-dark-text border-surface-muted dark:border-dark-surface-muted'
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>JSON</label>
                    <textarea
                      value={attrRaw}
                      onChange={(e) => setAttrRaw(e.target.value)}
                      rows={14}
                      className={`${inputCls} font-mono text-xs`}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Merchant form preview</label>
                <div className="border border-surface-muted dark:border-dark-surface-muted rounded-lg p-3 space-y-3 bg-surface-muted/30 dark:bg-dark-surface-muted/30 text-sm">
                  {attrSchema.axes && attrSchema.axes.length > 0 ? (
                    attrSchema.axes.map((axis) => (
                      <div key={axis}>
                        <div className="text-xs font-semibold text-muted dark:text-dark-muted">{axis}</div>
                        <input
                          disabled
                          placeholder={`e.g. ${axis === 'size' ? 'S / M / L' : axis === 'color' ? 'Black, Red' : axis === 'capacity' ? '64GB, 128GB' : `${axis} values`}`}
                          className={`${inputCls} mt-1 cursor-not-allowed`}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted dark:text-dark-muted">No axes - single-SKU product flow.</div>
                  )}
                  {attrSchema.pack && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-muted dark:border-dark-surface-muted">
                      <div>
                        <div className="text-xs font-semibold text-muted dark:text-dark-muted">Pack size</div>
                        <input disabled placeholder="500" className={`${inputCls} mt-1 cursor-not-allowed`} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted dark:text-dark-muted">Pack unit</div>
                        <select disabled className={`${inputCls} mt-1 cursor-not-allowed`}>
                          {(attrSchema.packUnits && attrSchema.packUnits.length > 0
                            ? attrSchema.packUnits
                            : PACK_UNITS).map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {attrError && <div className="text-sm text-error">{attrError}</div>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeAttrEditor}
                className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text"
                disabled={attrSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAttrSchema}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
                disabled={attrSaving}
              >
                {attrSaving ? 'Saving…' : 'Save schema'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <form
            onSubmit={submit}
            className="bg-surface dark:bg-dark-surface rounded-t-xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-text dark:text-dark-text">
              {editingId ? 'Edit Category' : 'New Category'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: editingId ? f.slug : slugify(name),
                    }))
                  }}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  className={inputCls}
                  placeholder="auto from name"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className={inputCls}
                placeholder="Order from restaurants"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Icon</label>
                <select
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  className={inputCls}
                >
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {opt.label} ({opt.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className={`${inputCls} h-10 p-1`}
                />
              </div>
              <div>
                <label className={labelCls}>Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <label className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
                <input
                  type="checkbox"
                  checked={form.hasPreparation}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hasPreparation: e.target.checked }))
                  }
                />
                Merchant prepares the order
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted text-text dark:text-dark-text"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create category'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
