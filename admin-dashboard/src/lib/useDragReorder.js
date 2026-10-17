import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Lightweight list reordering for a single ordered set of ids, driven by
 * Pointer Events so it works with BOTH touch (mobile) and mouse. HTML5
 * `draggable` is not used because it does not fire on touch devices.
 *
 * - Press and drag a row/tile to move it; the target index is computed from the
 *   pointer position over the registered elements.
 * - `move(id, -1 | 1)` swaps with its neighbour (keyboard/button/a11y path).
 *
 * `ids` must be the current display order; `onCommit` receives the new order.
 * The caller owns persistence (and can update optimistically).
 *
 * Ported from the ecommerce admin dashboard (useDragReorder.ts) - keep the two
 * in sync if you fix a bug in either.
 */
export const useDragReorder = (ids, onCommit, options = {}) => {
  const { live = false } = options
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)

  // Registered elements keyed by id, and the resolver supplied by the caller.
  const elements = useRef(new Map())
  const resolver = useRef(null)
  const stateRef = useRef({ ids, dragId: null })
  const lastOver = useRef(null)
  const liveRef = useRef(live)
  liveRef.current = live

  // Pending long-press state: on touch we wait before activating a drag so a
  // scroll gesture over a tile is never mistaken for a drag.
  const pressTimer = useRef(null)
  const pressStart = useRef(null)

  stateRef.current = { ids, dragId }

  const reset = useCallback(() => {
    setDragId(null)
    setOverId(null)
    lastOver.current = null
  }, [])

  const cancelPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressStart.current = null
  }, [])

  const commitDrop = useCallback(
    (targetId) => {
      const { dragId: dragging, ids: current } = stateRef.current
      if (!dragging || dragging === targetId) {
        reset()
        return
      }
      const from = current.indexOf(dragging)
      const to = current.indexOf(targetId)
      if (from < 0 || to < 0) {
        reset()
        return
      }
      const next = current.slice()
      next.splice(from, 1)
      next.splice(to, 0, dragging)
      onCommit(next)
      reset()
    },
    [onCommit, reset],
  )

  const computeTarget = useCallback((x, y) => {
    if (resolver.current) return resolver.current(x, y)
    // Fallback: element center distance.
    let best = null
    let bestDist = Infinity
    elements.current.forEach((el, id) => {
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
  }, [])

  useEffect(() => {
    if (!dragId) return

    // Block page scrolling while a drag is active (esp. touch).
    const prevTouchAction = document.body.style.touchAction
    const prevUserSelect = document.body.style.userSelect
    document.body.style.touchAction = 'none'
    document.body.style.userSelect = 'none'

    const onMove = (e) => {
      const target = computeTarget(e.clientX, e.clientY)
      if (target && target !== lastOver.current) {
        lastOver.current = target
        setOverId(target)
        // Live reorder: move the dragged item into the hovered slot right away
        // so the gap shows exactly where it will land on drop.
        if (liveRef.current) {
          const { dragId: dragging, ids: current } = stateRef.current
          if (dragging && dragging !== target) {
            const from = current.indexOf(dragging)
            const to = current.indexOf(target)
            if (from >= 0 && to >= 0 && from !== to) {
              const next = current.slice()
              next.splice(from, 1)
              next.splice(to, 0, dragging)
              onCommit(next)
            }
          }
        }
      }
      // Auto-scroll the page when dragging near the viewport edges.
      const margin = 64
      if (e.clientY < margin) window.scrollBy({ top: -12 })
      else if (e.clientY > window.innerHeight - margin) window.scrollBy({ top: 12 })
    }
    const onUp = () => {
      if (liveRef.current) {
        // Already reordered live during the drag - just finish.
        reset()
        return
      }
      const target = lastOver.current
      if (target) commitDrop(target)
      else reset()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.touchAction = prevTouchAction
      document.body.style.userSelect = prevUserSelect
    }
  }, [dragId, computeTarget, commitDrop, reset, onCommit])

  const move = useCallback(
    (id, direction) => {
      const from = ids.indexOf(id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= ids.length) return
      const next = ids.slice()
      ;[next[from], next[to]] = [next[to], next[from]]
      onCommit(next)
    },
    [ids, onCommit],
  )

  /**
   * Register a draggable element. Pointer-down on the element (or its grip)
   * starts the drag; the caller can also pass a dedicated handle id.
   */
  const registerItem = useCallback(
    (id) => (el) => {
      if (el) elements.current.set(id, el)
      else elements.current.delete(id)
    },
    [],
  )

  const setDropResolver = useCallback((fn) => {
    resolver.current = fn
  }, [])

  const startDrag = useCallback(
    (id) => (e) => {
      // Ignore drags starting on buttons/links (remove, etc).
      const target = e.target
      if (target.closest('button, a, input')) return

      // Mouse/pen: start dragging immediately (no scroll conflict).
      if (e.pointerType !== 'touch') {
        e.preventDefault()
        setDragId(id)
        return
      }

      // Touch: defer. Activate only after a short hold with little movement,
      // so scrolling (or a quick tap) never starts a drag.
      cancelPress()
      pressStart.current = { id, x: e.clientX, y: e.clientY }
      const startX = e.clientX
      const startY = e.clientY

      const onMove = (ev) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        // Moved enough to be a scroll/pan - abort the pending drag.
        if (dx * dx + dy * dy > 64) cleanup()
      }
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', cleanup)
        window.removeEventListener('pointercancel', cleanup)
        cancelPress()
      }

      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerup', cleanup)
      window.addEventListener('pointercancel', cleanup)

      pressTimer.current = window.setTimeout(() => {
        cleanup()
        setDragId(id)
      }, 200)
    },
    [cancelPress],
  )

  // Legacy HTML5 drag props (kept for existing consumers). Pointer events are
  // the preferred path; this remains for mouse users on desktop lists.
  const getItemProps = useCallback(
    (id) => ({
      draggable: true,
      onDragStart: (event) => {
        setDragId(id)
        event.dataTransfer.effectAllowed = 'move'
      },
      onDragEnd: reset,
      onDragOver: (event) => {
        event.preventDefault()
        if (id !== stateRef.current.dragId) setOverId(id)
      },
      onDrop: (event) => {
        event.preventDefault()
        commitDrop(id)
      },
    }),
    [commitDrop, reset],
  )

  return { dragId, overId, reset, move, registerItem, setDropResolver, startDrag, getItemProps }
}
