import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

/**
 * Kebab (⋮) row-action menu for table rows. Clicking the trigger opens a small
 * dropdown listing the row's actions, which keeps the actions column tidy
 * instead of spilling several buttons across two lines.
 *
 * The menu renders in a portal with fixed positioning so it is never clipped by
 * a table's `overflow-x-auto` scroll container.
 *
 * actions: [{ label, onClick, icon?, danger?, disabled?, title?, hidden? }]
 *   - icon: a lucide icon component
 *   - danger: render in the error colour (e.g. Delete / Suspend)
 *   - hidden: skip the item entirely (handy for conditional actions)
 */
const MENU_WIDTH = 192 // matches w-48

export default function ActionMenu({ actions = [], buttonLabel = 'Actions', align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const items = actions.filter((a) => a && !a.hidden)

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    let left = align === 'right' ? r.right - MENU_WIDTH : r.left
    // Keep the menu inside the viewport with an 8px gutter.
    left = Math.min(Math.max(left, 8), window.innerWidth - MENU_WIDTH - 8)
    setCoords({ top: r.bottom + 4, left })
  }

  const openMenu = () => {
    place()
    setOpen(true)
  }
  const closeMenu = () => setOpen(false)
  const toggle = () => (open ? closeMenu() : openMenu())

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        closeMenu()
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu()
    }
    // A fixed-positioned menu would drift if the page scrolls or resizes -
    // simplest correct behaviour is to close it.
    const onReflow = () => closeMenu()
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={buttonLabel}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted dark:text-dark-muted hover:bg-surface-muted dark:hover:bg-dark-surface-muted hover:text-text dark:hover:text-dark-text transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="z-50 rounded-lg border border-surface-muted dark:border-dark-surface-muted bg-surface dark:bg-dark-surface shadow-lg py-1"
          >
            {items.map((a, i) => {
              const Icon = a.icon
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={a.disabled}
                  title={a.title}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeMenu()
                    a.onClick?.()
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    a.danger
                      ? 'text-error hover:bg-error/10'
                      : 'text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span className="truncate">{a.label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
