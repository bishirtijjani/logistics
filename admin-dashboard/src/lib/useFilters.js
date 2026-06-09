import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

export const useFilters = (initialFilters = {}) => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Callers pass a fresh object literal every render (e.g.
  // useFilters({ search: '', status: '' })). Capturing it in a ref keeps the
  // sync effect below from depending on an ever-changing reference - otherwise
  // the effect ran on EVERY render and called setSearchParams each time. iOS
  // Safari rate-limits history.replaceState/pushState (SecurityError after
  // ~100 calls/30s), which turned that loop into a glitch/endless-reload on
  // iPhone while Chrome on laptop/Android shrugged it off.
  const initialRef = useRef(initialFilters)

  // Keep the latest setter in a ref so the effect can call it without listing
  // it as a dependency (its identity isn't guaranteed stable across renders).
  const setSearchParamsRef = useRef(setSearchParams)
  setSearchParamsRef.current = setSearchParams

  const [filters, setFilters] = useState(() => {
    const params = {}
    for (const [key, value] of searchParams.entries()) {
      params[key] = value
    }
    return { ...initialRef.current, ...params }
  })

  // Mirror filters into the URL only when the filters themselves change.
  useEffect(() => {
    const newParams = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && value !== initialRef.current[key]) {
        newParams[key] = value
      }
    })
    setSearchParamsRef.current(newParams, { replace: true })
  }, [filters])

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters(initialRef.current)
  }

  return { filters, updateFilter, resetFilters }
}
