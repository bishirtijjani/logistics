/**
 * MenuPage — merchant product catalogue.
 *
 * Phase 2: category-driven product form. The merchant selects a category, the
 * form reads `category.attributeSchema` from the backend, and renders only the
 * relevant inputs (axes, pack size, pack unit). Single-SKU products skip the
 * variant matrix and are created with one default variant. Multi-axis products
 * use the matrix builder. Food products can add option groups (sides, spice,
 * combos, etc.) with REQUIRED_ONE / OPTIONAL_MULTIPLE rules and per-item price
 * deltas.
 */

import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchProducts, createProduct, updateProduct, deleteProduct, toggleProductAvailability,
  createVariant, updateVariant, deleteVariant,
  createOptionGroup, updateOptionGroup, deleteOptionGroup,
  createOptionItem, updateOptionItem, deleteOptionItem,
} from '../store/slices/productsSlice.js'
import api from '../lib/api.js'
import { showErrorToast, showSuccessToast } from '../utils/toast.js'
import { Plus, X, Trash2, Edit3, ToggleLeft, ToggleRight, Package } from 'lucide-react'
import CloudinaryImageUploader from '../components/CloudinaryImageUploader.jsx'

const PACK_UNITS = ['ML','L','G','KG','TABLET','CAPSULE','PIECE','PAIR','PACK','BOTTLE','SACHET','CARTON']
const SELECTION_RULES = [
  { value: 'REQUIRED_ONE',      label: 'Required · Pick exactly one' },
  { value: 'OPTIONAL_ONE',      label: 'Optional · Pick at most one' },
  { value: 'REQUIRED_MULTIPLE', label: 'Required · Pick multiple' },
  { value: 'OPTIONAL_MULTIPLE', label: 'Optional · Pick multiple' },
]

const moneyFmt = (n) => `₦${Number(n || 0).toLocaleString()}`

const cartesian = (arrays) =>
  arrays.reduce(
    (acc, arr) => acc.flatMap((tuple) => arr.map((v) => [...tuple, v])),
    [[]]
  )

// ---------------------------------------------------------------------------
// VariantMatrixBuilder
// Given a category attributeSchema (axes + pack hint), shows axis value editors
// and generates a variant matrix. The merchant can prune rows, set per-row
// price + stock + image + isAvailable.
// ---------------------------------------------------------------------------

function VariantMatrixBuilder({ axes, pack, packUnits, variants, setVariants }) {
  // axis values keyed by axis name
  const [axisValues, setAxisValues] = useState(() => {
    const map = {}
    axes.forEach((a) => { map[a] = [] })
    // Hydrate from existing variants
    variants.forEach((v) => {
      Object.entries(v.attributes || {}).forEach(([k, val]) => {
        if (axes.includes(k) && !map[k].includes(val)) map[k].push(val)
      })
    })
    return map
  })

  const generateMatrix = () => {
    const filledAxes = axes.filter((a) => (axisValues[a] || []).length > 0)
    if (filledAxes.length === 0) {
      setVariants([{ attributes: {}, price: 0, stock: 0, isAvailable: true }])
      return
    }
    const combos = cartesian(filledAxes.map((a) => axisValues[a]))
    const next = combos.map((tuple) => {
      const attrs = {}
      filledAxes.forEach((a, i) => { attrs[a] = tuple[i] })
      // Preserve existing prices/stock if we already have a variant with the same attributes
      const existing = variants.find((v) =>
        filledAxes.every((a) => v.attributes && v.attributes[a] === attrs[a])
      )
      return existing || { attributes: attrs, price: 0, stock: 0, isAvailable: true }
    })
    setVariants(next)
  }

  const removeRow = (idx) => setVariants(variants.filter((_, i) => i !== idx))

  const patchRow = (idx, patch) => {
    setVariants(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }

  return (
    <div className="space-y-3">
      {axes.length > 0 && (
        <div className="space-y-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg p-3 bg-surface dark:bg-dark-surface">
          <div className="text-xs font-semibold text-muted dark:text-dark-muted">Axis values</div>
          {axes.map((axis) => (
            <div key={axis}>
              <div className="text-xs text-muted dark:text-dark-muted mb-1 capitalize">{axis}</div>
              <input
                type="text"
                placeholder={`comma-separated, e.g. ${axis === 'size' ? 'Small, Medium, Large' : axis === 'color' ? 'Black, Red, Blue' : `${axis} values`}`}
                value={(axisValues[axis] || []).join(', ')}
                onChange={(e) =>
                  setAxisValues({
                    ...axisValues,
                    [axis]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className={inputCls}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={generateMatrix}
            className="text-sm px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-700"
          >
            Generate variant matrix
          </button>
        </div>
      )}

      <div className="space-y-2">
        {variants.length === 0 ? (
          <div className="text-sm text-muted dark:text-dark-muted">
            {axes.length === 0
              ? 'Single-SKU product — set price & stock below.'
              : 'No variants yet. Fill axis values above and click "Generate variant matrix".'}
          </div>
        ) : (
          <div className="space-y-2">
            {variants.map((v, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface"
              >
                <CloudinaryImageUploader
                  size="sm"
                  value={v.imageUrl || ''}
                  onChange={(url) => patchRow(idx, { imageUrl: url || undefined })}
                />
                <div className="flex-1 min-w-[140px] text-sm text-text dark:text-dark-text">
                  {axes.map((a) => v.attributes?.[a]).filter(Boolean).join(' / ') || '—'}
                </div>
                {pack && (
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted dark:text-dark-muted">pack</label>
                    <input
                      type="number"
                      step="0.01"
                      value={v.packSize ?? ''}
                      onChange={(e) => patchRow(idx, { packSize: e.target.value ? Number(e.target.value) : undefined })}
                      className={`${smInputCls} w-20`}
                    />
                    <select
                      value={v.packUnit || ''}
                      onChange={(e) => patchRow(idx, { packUnit: e.target.value || undefined })}
                      className={smInputCls}
                    >
                      <option value="">—</option>
                      {(packUnits && packUnits.length > 0 ? packUnits : PACK_UNITS).map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted dark:text-dark-muted">₦</label>
                  <input
                    type="number"
                    value={v.price}
                    onChange={(e) => patchRow(idx, { price: Number(e.target.value) })}
                    className={`${smInputCls} w-24`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-muted dark:text-dark-muted">stock</label>
                  <input
                    type="number"
                    value={v.stock}
                    onChange={(e) => patchRow(idx, { stock: Number(e.target.value) })}
                    className={`${smInputCls} w-20`}
                  />
                </div>
                <label className="flex items-center gap-1 text-xs text-text dark:text-dark-text">
                  <input
                    type="checkbox"
                    checked={v.isAvailable !== false}
                    onChange={(e) => patchRow(idx, { isAvailable: e.target.checked })}
                    className="accent-primary"
                  />
                  available
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="ml-auto p-1.5 text-error hover:bg-error/10 rounded"
                  title="Remove variant"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OptionGroupsBuilder — inline editor used on product CREATE only. Existing
// products use the per-row option-group endpoints (added in EditProductModal).
// ---------------------------------------------------------------------------

function OptionGroupsBuilder({ groups, setGroups }) {
  const addGroup = () => {
    setGroups([
      ...groups,
      { name: '', selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 1, sortOrder: groups.length, items: [] },
    ])
  }
  const patchGroup = (idx, patch) =>
    setGroups(groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)))
  const removeGroup = (idx) => setGroups(groups.filter((_, i) => i !== idx))

  const addItem = (groupIdx) => {
    setGroups(
      groups.map((g, i) =>
        i === groupIdx
          ? { ...g, items: [...g.items, { name: '', description: '', priceDelta: 0, imageUrl: '', isDefault: false, isAvailable: true, sortOrder: g.items.length }] }
          : g
      )
    )
  }
  const patchItem = (groupIdx, itemIdx, patch) =>
    setGroups(
      groups.map((g, i) =>
        i === groupIdx
          ? { ...g, items: g.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)) }
          : g
      )
    )
  const removeItem = (groupIdx, itemIdx) =>
    setGroups(groups.map((g, i) => (i === groupIdx ? { ...g, items: g.items.filter((_, j) => j !== itemIdx) } : g)))

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <div className="text-xs text-muted dark:text-dark-muted px-1">
          No groups yet. Add one for choices like sides, spice level, or extras.
        </div>
      )}

      {groups.map((group, gi) => (
        <div
          key={gi}
          className="rounded-xl border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface overflow-hidden"
        >
          {/* Group header */}
          <div className="px-3 py-3 bg-surface-muted/40 dark:bg-dark-surface-muted/40 border-b border-surface-muted dark:border-dark-surface-muted space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Group name (e.g. Sides, Spice level)"
                value={group.name}
                onChange={(e) => patchGroup(gi, { name: e.target.value })}
                className={`${inputCls} font-medium`}
              />
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                className="p-2 text-error hover:bg-error/10 rounded-md"
                title="Remove group"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted dark:text-dark-muted block mb-1">Rule</label>
                <select
                  value={group.selectionRule}
                  onChange={(e) => patchGroup(gi, { selectionRule: e.target.value })}
                  className={inputCls}
                >
                  {SELECTION_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted dark:text-dark-muted block mb-1">Min picks</label>
                <input
                  type="number"
                  min="0"
                  value={group.minSelect}
                  onChange={(e) => patchGroup(gi, { minSelect: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-muted dark:text-dark-muted block mb-1">Max picks</label>
                <input
                  type="number"
                  min="1"
                  value={group.maxSelect}
                  onChange={(e) => patchGroup(gi, { maxSelect: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted dark:text-dark-muted uppercase tracking-wide">
              Items
            </div>
            {group.items.length === 0 && (
              <div className="text-xs text-muted dark:text-dark-muted">
                Add the choices customers can pick from.
              </div>
            )}
            {group.items.map((it, ii) => (
              <div
                key={ii}
                className="rounded-lg border border-surface-muted dark:border-dark-surface-muted p-2 sm:p-3 bg-surface dark:bg-dark-surface"
              >
                <div className="flex gap-3">
                  <CloudinaryImageUploader
                    size="sm"
                    value={it.imageUrl || ''}
                    onChange={(url) => patchItem(gi, ii, { imageUrl: url })}
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Item name (e.g. Plantain)"
                      value={it.name}
                      onChange={(e) => patchItem(gi, ii, { name: e.target.value })}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Short description (optional)"
                      value={it.description || ''}
                      onChange={(e) => patchItem(gi, ii, { description: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(gi, ii)}
                    className="self-start p-1.5 text-error hover:bg-error/10 rounded"
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 pl-[3.75rem] sm:pl-[4rem]">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted dark:text-dark-muted">+₦</label>
                    <input
                      type="number"
                      value={it.priceDelta}
                      onChange={(e) => patchItem(gi, ii, { priceDelta: Number(e.target.value) })}
                      className={`${smInputCls} w-24`}
                    />
                  </div>
                  <label className="text-xs flex items-center gap-1 text-text dark:text-dark-text">
                    <input
                      type="checkbox"
                      checked={!!it.isDefault}
                      onChange={(e) => patchItem(gi, ii, { isDefault: e.target.checked })}
                      className="accent-primary"
                    />
                    Default pick
                  </label>
                  <label className="text-xs flex items-center gap-1 text-text dark:text-dark-text">
                    <input
                      type="checkbox"
                      checked={it.isAvailable !== false}
                      onChange={(e) => patchItem(gi, ii, { isAvailable: e.target.checked })}
                      className="accent-primary"
                    />
                    Available
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addItem(gi)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="w-full sm:w-auto px-4 py-2 border-2 border-dashed border-surface-muted dark:border-dark-surface-muted hover:border-primary dark:hover:border-primary rounded-lg text-sm text-text dark:text-dark-text hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Add option group
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MenuPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((s) => s.auth)
  const merchantId = user?.merchantId
  const { products, loading } = useSelector((s) => s.products)

  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null) // product being edited

  useEffect(() => {
    if (!merchantId) return
    dispatch(fetchProducts({ merchantId }))
    api.get('/categories').then((r) => setCategories(r.data.data || [])).catch(() => {})
  }, [dispatch, merchantId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
  }, [products, search])

  const onCreated = async (payload) => {
    try {
      await dispatch(createProduct({ merchantId, productData: payload })).unwrap()
      showSuccessToast('Product created')
      setShowCreate(false)
    } catch (e) {
      showErrorToast(e?.message || 'Create failed')
    }
  }

  const onDelete = async (productId) => {
    if (!confirm('Delete this product?')) return
    try {
      await dispatch(deleteProduct({ merchantId, productId })).unwrap()
      showSuccessToast('Deleted')
    } catch (e) {
      showErrorToast(e?.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-dark-text">Products</h1>
          <p className="text-sm text-muted dark:text-dark-muted">
            Category-driven form: select your category, the form renders the right axes and pack inputs automatically.
          </p>
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 sm:flex-none sm:w-56 border border-surface-muted dark:border-dark-surface-muted rounded-lg px-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text placeholder:text-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 whitespace-nowrap px-4 py-2 bg-primary text-white rounded-lg text-sm flex items-center gap-2 hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> New Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && products.length === 0 ? (
          <div className="col-span-full text-muted dark:text-dark-muted text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-muted dark:text-dark-muted text-sm">No products yet.</div>
        ) : (
          filtered.map((p) => <ProductCard key={p.id} product={p} merchantId={merchantId} onEdit={() => setEditing(p)} onDelete={() => onDelete(p.id)} />)
        )}
      </div>

      {showCreate && (
        <ProductCreateModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onSubmit={onCreated}
        />
      )}

      {editing && (
        <ProductEditModal
          product={editing}
          categories={categories}
          merchantId={merchantId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ProductCard({ product, merchantId, onEdit, onDelete }) {
  const dispatch = useDispatch()
  const lowestPrice = useMemo(() => {
    const prices = (product.variants || []).map((v) => Number(v.price)).filter((n) => !Number.isNaN(n))
    return prices.length ? Math.min(...prices) : Number(product.basePrice || 0)
  }, [product])

  const totalStock = useMemo(
    () => (product.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0),
    [product]
  )

  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-surface-muted dark:border-dark-surface-muted p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold text-text dark:text-dark-text">{product.name}</div>
          <div className="text-xs text-muted dark:text-dark-muted">{product.description || '—'}</div>
          <div className="mt-1 text-sm text-text dark:text-dark-text font-medium">
            from {moneyFmt(lowestPrice)} · {totalStock} in stock
          </div>
        </div>
        {product.imageUrl && (
          <img src={product.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />
        )}
      </div>

      <div className="flex flex-wrap gap-1 mt-1">
        {(product.variants || []).map((v) => (
          <span
            key={v.id}
            className={`text-xs px-2 py-0.5 rounded ${
              v.isAvailable ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error line-through'
            }`}
          >
            {Object.entries(v.attributes || {}).map(([k, val]) => `${val}`).join(' / ') || (v.packLabel || 'default')}
            {' '}· {moneyFmt(v.price)} · {v.stock}
          </span>
        ))}
      </div>

      {(product.optionGroups || []).length > 0 && (
        <div className="text-xs text-muted dark:text-dark-muted">
          {product.optionGroups.length} option group{product.optionGroups.length !== 1 ? 's' : ''}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-surface-muted dark:border-dark-surface-muted">
        <button
          onClick={() =>
            dispatch(toggleProductAvailability({ merchantId, productId: product.id, isAvailable: !product.isAvailable }))
          }
          className="text-sm text-text dark:text-dark-text flex items-center gap-1"
          title={product.isAvailable ? '86 / hide from customers' : 'Make available'}
        >
          {product.isAvailable ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          {product.isAvailable ? 'Available' : 'Hidden'}
        </button>
        <button onClick={onEdit} className="ml-auto text-sm text-primary flex items-center gap-1">
          <Edit3 size={14} /> Edit
        </button>
        <button onClick={onDelete} className="text-sm text-error flex items-center gap-1">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create modal — inline variants + option groups all at once
// ---------------------------------------------------------------------------

const inputCls = 'w-full border border-surface-muted dark:border-dark-surface-muted rounded-lg px-3 py-2 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/30'
const smInputCls = 'border border-surface-muted dark:border-dark-surface-muted rounded px-2 py-1 text-sm bg-surface dark:bg-dark-surface text-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/30'
const ghostBtnCls = 'px-3 py-1.5 border border-surface-muted dark:border-dark-surface-muted rounded-md text-sm text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors'

function ProductCreateModal({ categories, onClose, onSubmit }) {
  const [categoryId, setCategoryId] = useState('')
  const selectedCategory = categories.find((c) => c.id === categoryId)
  const schema = selectedCategory?.attributeSchema || {}
  const axes = Array.isArray(schema.axes) ? schema.axes : []
  const pack = !!schema.pack
  const packUnits = Array.isArray(schema.packUnits) ? schema.packUnits : []

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [requiresPrescription, setRequiresPrescription] = useState(false)
  const [dosage, setDosage] = useState('')
  const [singleSku, setSingleSku] = useState(true)
  const [singlePrice, setSinglePrice] = useState(0)
  const [singleStock, setSingleStock] = useState(0)
  const [singlePackSize, setSinglePackSize] = useState('')
  const [singlePackUnit, setSinglePackUnit] = useState('')
  const [variants, setVariants] = useState([])
  const [optionGroups, setOptionGroups] = useState([])
  const [saving, setSaving] = useState(false)

  // When the user picks a category with axes, force into multi-variant mode by default.
  useEffect(() => {
    if (axes.length > 0) setSingleSku(false)
    else setSingleSku(true)
  }, [categoryId]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return showErrorToast('Name required')
    if (!selectedCategory) return showErrorToast('Pick a category')

    let inlineVariants
    if (singleSku) {
      inlineVariants = [{
        attributes: {},
        price: Number(singlePrice) || 0,
        stock: Number(singleStock) || 0,
        ...(pack && singlePackSize ? { packSize: Number(singlePackSize) } : {}),
        ...(pack && singlePackUnit ? { packUnit: singlePackUnit } : {}),
      }]
    } else {
      if (variants.length === 0) return showErrorToast('Generate at least one variant')
      inlineVariants = variants.map((v) => ({
        attributes: v.attributes || {},
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        sku: v.sku || undefined,
        ...(pack && v.packSize ? { packSize: Number(v.packSize) } : {}),
        ...(pack && v.packUnit ? { packUnit: v.packUnit } : {}),
        imageUrl: v.imageUrl || undefined,
        isAvailable: v.isAvailable !== false,
      }))
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      basePrice: inlineVariants[0].price,
      category: selectedCategory.slug,
      imageUrl: imageUrl || undefined,
      stock: inlineVariants.reduce((sum, v) => sum + (v.stock || 0), 0),
      requiresPrescription,
      dosage: dosage || undefined,
      variants: inlineVariants,
      optionGroups: optionGroups
        .filter((g) => g.name.trim())
        .map((g) => ({
          name: g.name.trim(),
          selectionRule: g.selectionRule,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          sortOrder: g.sortOrder,
          items: g.items
            .filter((it) => it.name.trim())
            .map((it) => ({
              name: it.name.trim(),
              priceDelta: Number(it.priceDelta) || 0,
              isDefault: !!it.isDefault,
              isAvailable: it.isAvailable !== false,
              sortOrder: it.sortOrder,
            })),
        })),
    }

    setSaving(true)
    try {
      await onSubmit(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <form
        onSubmit={submit}
        className="bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[95dvh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="text-lg font-semibold text-text dark:text-dark-text">New Product</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 -mr-1 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Category *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">— pick a category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedCategory && (
            <p className="text-xs text-muted dark:text-dark-muted mt-1">
              {axes.length > 0 && <>Axes: <strong>{axes.join(', ')}</strong>. </>}
              {pack && <>Pack units enabled.</>}
              {axes.length === 0 && !pack && <>Single-SKU category.</>}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required />
        </div>

        <div>
          <CloudinaryImageUploader value={imageUrl} onChange={setImageUrl} label="Product image" />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} rows={2} />
        </div>

        {selectedCategory?.slug === 'pharmacy' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
              <input
                type="checkbox"
                checked={requiresPrescription}
                onChange={(e) => setRequiresPrescription(e.target.checked)}
                className="accent-primary"
              />
              Requires prescription
            </label>
            <div>
              <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Dosage</label>
              <input type="text" value={dosage} onChange={(e) => setDosage(e.target.value)} className={inputCls} placeholder="e.g. Take 1 tablet twice daily" />
            </div>
          </div>
        )}

        <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-text dark:text-dark-text">Variants</label>
            {axes.length > 0 && (
              <label className="text-xs flex items-center gap-1 text-text dark:text-dark-text">
                <input
                  type="checkbox"
                  checked={singleSku}
                  onChange={(e) => setSingleSku(e.target.checked)}
                  className="accent-primary"
                />
                Single SKU (skip matrix)
              </label>
            )}
          </div>

          {singleSku ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-muted dark:text-dark-muted block mb-1">Price *</label>
                <input type="number" value={singlePrice} onChange={(e) => setSinglePrice(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className="text-xs text-muted dark:text-dark-muted block mb-1">Stock</label>
                <input type="number" value={singleStock} onChange={(e) => setSingleStock(e.target.value)} className={inputCls} />
              </div>
              {pack && (
                <>
                  <div>
                    <label className="text-xs text-muted dark:text-dark-muted block mb-1">Pack size</label>
                    <input type="number" step="0.01" value={singlePackSize} onChange={(e) => setSinglePackSize(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted dark:text-dark-muted block mb-1">Pack unit</label>
                    <select value={singlePackUnit} onChange={(e) => setSinglePackUnit(e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {(packUnits.length > 0 ? packUnits : PACK_UNITS).map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          ) : (
            <VariantMatrixBuilder
              axes={axes}
              pack={pack}
              packUnits={packUnits}
              variants={variants}
              setVariants={setVariants}
            />
          )}
        </div>

        {selectedCategory?.hasPreparation && (
          <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-text dark:text-dark-text">Option groups</label>
              <span className="text-xs text-muted dark:text-dark-muted">Sides, spice, addons, etc.</span>
            </div>
            <OptionGroupsBuilder groups={optionGroups} setGroups={setOptionGroups} />
          </div>
        )}

        </div>

        <div className="flex gap-3 px-4 sm:px-6 py-4 border-t border-surface-muted dark:border-dark-surface-muted pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-surface-muted dark:border-dark-surface-muted rounded-lg text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors"
          >
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 font-medium">
            {saving ? 'Saving…' : 'Create product'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit modal — uses per-row endpoints for variants + option groups so the
// merchant can incrementally add/remove rows on an existing product.
// ---------------------------------------------------------------------------

function ProductEditModal({ product, categories, merchantId, onClose }) {
  const dispatch = useDispatch()
  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description || '')
  const [imageUrl, setImageUrl] = useState(product.imageUrl || '')
  // Phase 8 — pharmacy fields, editable on the existing product so merchants
  // can flag/clear the Rx requirement or update the dosage label after creation.
  const [requiresPrescription, setRequiresPrescription] = useState(Boolean(product.requiresPrescription))
  const [dosage, setDosage] = useState(product.dosage || '')
  const [saving, setSaving] = useState(false)

  const category = categories.find((c) => c.slug === product.category)
  const schema = category?.attributeSchema || {}
  const axes = Array.isArray(schema.axes) ? schema.axes : []
  const pack = !!schema.pack
  const packUnits = Array.isArray(schema.packUnits) ? schema.packUnits : []
  const isPharmacy = category?.slug === 'pharmacy'

  const saveBasics = async () => {
    setSaving(true)
    try {
      await dispatch(
        updateProduct({
          merchantId,
          productId: product.id,
          productData: {
            name,
            description,
            imageUrl: imageUrl || undefined,
            // Only send pharmacy fields for pharmacy products so a category
            // change later doesn't leak Rx state onto a food/grocery row.
            ...(isPharmacy
              ? { requiresPrescription, dosage: dosage || undefined }
              : {}),
          },
        })
      ).unwrap()
      showSuccessToast('Saved')
    } catch (e) {
      showErrorToast(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-surface dark:bg-dark-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-4xl max-h-[95dvh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-muted dark:border-dark-surface-muted">
          <h2 className="text-lg font-semibold text-text dark:text-dark-text truncate pr-2">Edit — {product.name}</h2>
          <button
            onClick={onClose}
            className="p-2.5 -mr-1 shrink-0 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <CloudinaryImageUploader value={imageUrl} onChange={setImageUrl} label="Product image" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} rows={2} />
        </div>

        {/* Phase 8 — pharmacy product edit fields. Hidden for non-pharmacy
            categories to keep the form focused. */}
        {isPharmacy && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-text dark:text-dark-text">
              <input
                type="checkbox"
                checked={requiresPrescription}
                onChange={(e) => setRequiresPrescription(e.target.checked)}
                className="accent-primary"
              />
              Requires prescription
            </label>
            <div>
              <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Dosage</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className={inputCls}
                placeholder="e.g. Take 1 tablet twice daily"
              />
            </div>
          </div>
        )}

        <button onClick={saveBasics} disabled={saving} className="px-3 py-1.5 bg-primary text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save basics'}
        </button>

        {/* Variants */}
        <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-text dark:text-dark-text">Variants</h3>
            <span className="text-xs text-muted dark:text-dark-muted">
              {axes.length > 0 ? `Axes: ${axes.join(', ')}` : 'Single-SKU category'}
            </span>
          </div>
          <VariantsTable product={product} merchantId={merchantId} axes={axes} pack={pack} packUnits={packUnits} />
        </div>

        {/* Option groups */}
        {category?.hasPreparation && (
          <div className="border-t border-surface-muted dark:border-dark-surface-muted pt-3">
            <h3 className="font-semibold text-text dark:text-dark-text mb-2">Option groups</h3>
            <OptionGroupsTable product={product} merchantId={merchantId} />
          </div>
        )}

        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-surface-muted dark:border-dark-surface-muted pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-700 font-medium">Close</button>
        </div>
      </div>
    </div>
  )
}

function VariantsTable({ product, merchantId, axes, pack, packUnits }) {
  const dispatch = useDispatch()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ attributes: {}, price: 0, stock: 0, packSize: '', packUnit: '', imageUrl: '', isAvailable: true })

  const addVariant = async () => {
    try {
      await dispatch(
        createVariant({
          merchantId,
          productId: product.id,
          variant: {
            attributes: draft.attributes,
            price: Number(draft.price) || 0,
            stock: Number(draft.stock) || 0,
            ...(pack && draft.packSize ? { packSize: Number(draft.packSize) } : {}),
            ...(pack && draft.packUnit ? { packUnit: draft.packUnit } : {}),
            ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
            isAvailable: draft.isAvailable,
          },
        })
      ).unwrap()
      setAdding(false)
      setDraft({ attributes: {}, price: 0, stock: 0, packSize: '', packUnit: '', imageUrl: '', isAvailable: true })
      showSuccessToast('Variant added')
    } catch (e) {
      showErrorToast(e?.message || 'Failed to add variant')
    }
  }

  const remove = async (variantId) => {
    if (!confirm('Delete this variant?')) return
    try {
      await dispatch(deleteVariant({ merchantId, productId: product.id, variantId })).unwrap()
      showSuccessToast('Variant removed')
    } catch (e) {
      showErrorToast(e?.message || 'Delete failed')
    }
  }

  const patch = async (variantId, partial) => {
    try {
      await dispatch(updateVariant({ merchantId, productId: product.id, variantId, patch: partial })).unwrap()
    } catch (e) {
      showErrorToast(e?.message || 'Update failed')
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {(product.variants || []).map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface"
          >
            <CloudinaryImageUploader
              size="sm"
              value={v.imageUrl || ''}
              onChange={(url) => patch(v.id, { imageUrl: url || null })}
            />
            <div className="flex-1 min-w-[140px] text-sm text-text dark:text-dark-text">
              {axes.map((a) => v.attributes?.[a]).filter(Boolean).join(' / ') || (v.packLabel || 'default')}
              {pack && v.packLabel && (
                <div className="text-xs text-muted dark:text-dark-muted">{v.packLabel}</div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted dark:text-dark-muted">₦</label>
              <input
                type="number"
                defaultValue={v.price}
                onBlur={(e) => {
                  const next = Number(e.target.value)
                  if (next !== Number(v.price)) patch(v.id, { price: next })
                }}
                className={`${smInputCls} w-24`}
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted dark:text-dark-muted">stock</label>
              <input
                type="number"
                defaultValue={v.stock}
                onBlur={(e) => {
                  const next = Number(e.target.value)
                  if (next !== Number(v.stock)) patch(v.id, { stock: next })
                }}
                className={`${smInputCls} w-20`}
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-text dark:text-dark-text">
              <input
                type="checkbox"
                checked={v.isAvailable}
                onChange={(e) => patch(v.id, { isAvailable: e.target.checked })}
                className="accent-primary"
              />
              available
            </label>
            <button
              onClick={() => remove(v.id)}
              className="ml-auto p-1.5 text-error hover:bg-error/10 rounded"
              title="Remove variant"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-lg p-3 space-y-2">
          <div className="flex gap-3">
            <CloudinaryImageUploader
              size="sm"
              value={draft.imageUrl}
              onChange={(url) => setDraft({ ...draft, imageUrl: url })}
            />
            <div className="flex-1 space-y-2">
              {axes.map((a) => (
                <div key={a} className="flex items-center gap-2">
                  <label className="text-xs w-20 text-muted dark:text-dark-muted capitalize">{a}</label>
                  <input
                    type="text"
                    value={draft.attributes[a] || ''}
                    onChange={(e) => setDraft({ ...draft, attributes: { ...draft.attributes, [a]: e.target.value } })}
                    className={`${smInputCls} flex-1`}
                  />
                </div>
              ))}
            </div>
          </div>
          {pack && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted dark:text-dark-muted">pack</label>
              <input
                type="number"
                step="0.01"
                placeholder="size"
                value={draft.packSize}
                onChange={(e) => setDraft({ ...draft, packSize: e.target.value })}
                className={`${smInputCls} w-24`}
              />
              <select
                value={draft.packUnit}
                onChange={(e) => setDraft({ ...draft, packUnit: e.target.value })}
                className={smInputCls}
              >
                <option value="">—</option>
                {(packUnits.length > 0 ? packUnits : PACK_UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted dark:text-dark-muted">₦</label>
              <input
                type="number"
                placeholder="price"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                className={`${smInputCls} w-24`}
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted dark:text-dark-muted">stock</label>
              <input
                type="number"
                placeholder="stock"
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                className={`${smInputCls} w-20`}
              />
            </div>
            <button onClick={addVariant} className="ml-auto text-sm px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-700">Add</button>
            <button onClick={() => setAdding(false)} className={ghostBtnCls}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-primary flex items-center gap-1 hover:underline">
          <Plus size={14} /> Add variant
        </button>
      )}
    </div>
  )
}

function OptionGroupsTable({ product, merchantId }) {
  const dispatch = useDispatch()
  const [addingGroup, setAddingGroup] = useState(false)
  const [groupDraft, setGroupDraft] = useState({ name: '', selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 1 })

  const addGroup = async () => {
    if (!groupDraft.name.trim()) return showErrorToast('Group name required')
    try {
      await dispatch(
        createOptionGroup({
          merchantId,
          productId: product.id,
          group: { ...groupDraft, sortOrder: (product.optionGroups || []).length, items: [] },
        })
      ).unwrap()
      setAddingGroup(false)
      setGroupDraft({ name: '', selectionRule: 'REQUIRED_ONE', minSelect: 1, maxSelect: 1 })
      showSuccessToast('Group added')
    } catch (e) {
      showErrorToast(e?.message || 'Failed')
    }
  }

  const removeGroup = async (groupId) => {
    if (!confirm('Delete this option group and all its items?')) return
    try {
      await dispatch(deleteOptionGroup({ merchantId, productId: product.id, groupId })).unwrap()
    } catch (e) {
      showErrorToast(e?.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      {(product.optionGroups || []).map((g) => (
        <OptionGroupRow key={g.id} group={g} product={product} merchantId={merchantId} onDelete={() => removeGroup(g.id)} />
      ))}
      {addingGroup ? (
        <div className="border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface rounded-xl p-3 space-y-2">
          <div>
            <label className="text-xs font-semibold text-muted dark:text-dark-muted block mb-1">Group name</label>
            <input
              type="text"
              placeholder="e.g. Sides, Spice level"
              value={groupDraft.name}
              onChange={(e) => setGroupDraft({ ...groupDraft, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted dark:text-dark-muted block mb-1">Rule</label>
              <select
                value={groupDraft.selectionRule}
                onChange={(e) => setGroupDraft({ ...groupDraft, selectionRule: e.target.value })}
                className={inputCls}
              >
                {SELECTION_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted dark:text-dark-muted block mb-1">Min picks</label>
              <input
                type="number"
                min="0"
                value={groupDraft.minSelect}
                onChange={(e) => setGroupDraft({ ...groupDraft, minSelect: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-muted dark:text-dark-muted block mb-1">Max picks</label>
              <input
                type="number"
                min="1"
                value={groupDraft.maxSelect}
                onChange={(e) => setGroupDraft({ ...groupDraft, maxSelect: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setAddingGroup(false)} className={ghostBtnCls}>Cancel</button>
            <button onClick={addGroup} className="text-sm px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-700">Add group</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingGroup(true)}
          className="w-full sm:w-auto px-4 py-2 border-2 border-dashed border-surface-muted dark:border-dark-surface-muted hover:border-primary dark:hover:border-primary rounded-lg text-sm text-text dark:text-dark-text hover:text-primary dark:hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add option group
        </button>
      )}
    </div>
  )
}

function OptionGroupRow({ group, product, merchantId, onDelete }) {
  const dispatch = useDispatch()
  const [addingItem, setAddingItem] = useState(false)
  const [itemDraft, setItemDraft] = useState({ name: '', description: '', priceDelta: 0, imageUrl: '', isDefault: false })

  const addItem = async () => {
    if (!itemDraft.name.trim()) return
    try {
      await dispatch(
        createOptionItem({
          merchantId, productId: product.id, groupId: group.id,
          item: {
            name: itemDraft.name.trim(),
            description: itemDraft.description?.trim() || undefined,
            priceDelta: Number(itemDraft.priceDelta) || 0,
            imageUrl: itemDraft.imageUrl || undefined,
            isDefault: itemDraft.isDefault,
            sortOrder: (group.items || []).length,
          },
        })
      ).unwrap()
      setAddingItem(false)
      setItemDraft({ name: '', description: '', priceDelta: 0, imageUrl: '', isDefault: false })
    } catch (e) {
      showErrorToast(e?.message || 'Failed')
    }
  }

  const toggleAvail = (item) =>
    dispatch(updateOptionItem({
      merchantId, productId: product.id, groupId: group.id, itemId: item.id,
      patch: { isAvailable: !item.isAvailable },
    }))

  const patchItem = (item, patch) =>
    dispatch(updateOptionItem({
      merchantId, productId: product.id, groupId: group.id, itemId: item.id,
      patch,
    }))

  const removeItem = (itemId) => {
    if (!confirm('Delete this item?')) return
    dispatch(deleteOptionItem({ merchantId, productId: product.id, groupId: group.id, itemId }))
  }

  return (
    <div className="rounded-xl border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface overflow-hidden">
      <div className="px-3 py-3 bg-surface-muted/40 dark:bg-dark-surface-muted/40 border-b border-surface-muted dark:border-dark-surface-muted flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-text dark:text-dark-text truncate">{group.name}</div>
          <div className="text-xs text-muted dark:text-dark-muted">
            {SELECTION_RULES.find((r) => r.value === group.selectionRule)?.label} · min {group.minSelect} · max {group.maxSelect}
          </div>
        </div>
        <button onClick={onDelete} className="p-2 text-error hover:bg-error/10 rounded-md" title="Delete group">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="p-3 space-y-2">
        {(group.items || []).map((it) => (
          <div
            key={it.id}
            className={`rounded-lg border border-surface-muted dark:border-dark-surface-muted p-2 sm:p-3 ${!it.isAvailable ? 'opacity-60' : ''}`}
          >
            <div className="flex gap-3 items-start">
              <CloudinaryImageUploader
                size="sm"
                value={it.imageUrl || ''}
                onChange={(url) => patchItem(it, { imageUrl: url || null })}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium truncate ${!it.isAvailable ? 'line-through text-muted dark:text-dark-muted' : 'text-text dark:text-dark-text'}`}>
                    {it.name}
                  </span>
                  {it.isDefault && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">default</span>
                  )}
                  {Number(it.priceDelta) !== 0 && (
                    <span className="text-xs text-muted dark:text-dark-muted">+{moneyFmt(it.priceDelta)}</span>
                  )}
                </div>
                {it.description && (
                  <div className="text-xs text-muted dark:text-dark-muted mt-0.5 truncate">{it.description}</div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleAvail(it)}
                  className="text-xs px-2 py-1 rounded border border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted"
                  title={it.isAvailable ? 'Mark unavailable' : 'Restore'}
                >
                  {it.isAvailable ? '86 it' : 'Restore'}
                </button>
                <button onClick={() => removeItem(it.id)} className="p-1.5 text-error hover:bg-error/10 rounded" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {addingItem ? (
          <div className="rounded-lg border border-surface-muted dark:border-dark-surface-muted p-3 space-y-2 bg-surface-muted/40 dark:bg-dark-surface-muted/40">
            <div className="flex gap-3">
              <CloudinaryImageUploader
                size="sm"
                value={itemDraft.imageUrl}
                onChange={(url) => setItemDraft({ ...itemDraft, imageUrl: url })}
              />
              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  placeholder="Item name"
                  value={itemDraft.name}
                  onChange={(e) => setItemDraft({ ...itemDraft, name: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Short description (optional)"
                  value={itemDraft.description}
                  onChange={(e) => setItemDraft({ ...itemDraft, description: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <label className="text-xs text-muted dark:text-dark-muted">+₦</label>
                <input
                  type="number"
                  value={itemDraft.priceDelta}
                  onChange={(e) => setItemDraft({ ...itemDraft, priceDelta: e.target.value })}
                  className={`${smInputCls} w-24`}
                />
              </div>
              <label className="text-xs flex items-center gap-1 text-text dark:text-dark-text">
                <input
                  type="checkbox"
                  checked={itemDraft.isDefault}
                  onChange={(e) => setItemDraft({ ...itemDraft, isDefault: e.target.checked })}
                  className="accent-primary"
                />
                Default pick
              </label>
              <button onClick={() => setAddingItem(false)} className={`${ghostBtnCls} ml-auto`}>Cancel</button>
              <button onClick={addItem} className="text-sm px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-700">Add item</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingItem(true)}
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            <Plus size={14} /> Add item
          </button>
        )}
      </div>
    </div>
  )
}
