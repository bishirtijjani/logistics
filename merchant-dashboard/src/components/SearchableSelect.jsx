import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'

// Layout + skin for the trigger button. Callers can swap the whole thing via
// `triggerClassName` to match a form's input style, but should keep the
// `flex items-center justify-between` so the chevron stays put.
const DEFAULT_TRIGGER =
  'w-full flex items-center justify-between gap-2 px-4 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-surface dark:bg-dark-surface text-left disabled:opacity-60 disabled:cursor-not-allowed'

/**
 * Accessible, searchable single-select dropdown. Built for long option lists
 * (e.g. the Nigerian bank list, business categories) where scrolling a native
 * <select> or a grid of cards is painful - the user types to filter instead.
 *
 * options: [{ value, label, description?, color? }]
 *   - description: muted second line shown under the label
 *   - color: small swatch shown before the label (e.g. category colour)
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  loading = false,
  emptyText = 'No matches',
  id,
  triggerClassName = DEFAULT_TRIGGER,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q),
    )
  }, [options, query])

  const openMenu = () => {
    setActiveIndex(-1)
    setOpen(true)
  }

  const closeMenu = () => {
    setOpen(false)
    setQuery('')
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Focus the search box once the dropdown has rendered.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  // Keep the highlighted option in view while arrow-keying.
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return
    listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const choose = (opt) => {
    onChange(opt.value)
    closeMenu()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        openMenu()
        return
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault()
        choose(filtered[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        closeMenu()
      }
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        disabled={disabled || loading}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={triggerClassName}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected?.color && (
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ background: selected.color }}
            />
          )}
          <span
            className={`truncate ${selected ? 'text-text dark:text-dark-text' : 'text-muted dark:text-dark-muted'}`}
          >
            {loading ? 'Loading…' : selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted dark:text-dark-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface shadow-lg">
          <div className="p-2 border-b border-surface-muted dark:border-dark-surface-muted">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted dark:text-dark-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-surface-muted dark:border-dark-surface-muted rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-surface dark:bg-dark-surface text-text dark:text-dark-text"
              />
            </div>
          </div>
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted dark:text-dark-muted text-center">
                {emptyText}
              </li>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = opt.value === value
                const isActive = i === activeIndex
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(opt)}
                    className={`flex items-center justify-between gap-2 px-4 py-2 text-sm cursor-pointer ${
                      isActive ? 'bg-primary/10 dark:bg-primary/20' : ''
                    } ${isSelected ? 'text-primary' : 'text-text dark:text-dark-text'}`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {opt.color && (
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ background: opt.color }}
                        />
                      )}
                      <span className="min-w-0">
                        <span className={`block truncate ${isSelected ? 'font-medium' : ''}`}>
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="block truncate text-xs text-muted dark:text-dark-muted">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}