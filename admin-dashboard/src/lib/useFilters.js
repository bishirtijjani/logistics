import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export const useFilters = (initialFilters = {}) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => {
    const params = {}
    for (const [key, value] of searchParams.entries()) {
      params[key] = value
    }
    return { ...initialFilters, ...params }
  })

  useEffect(() => {
    const newParams = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && value !== initialFilters[key]) {
        newParams[key] = value
      }
    })
    setSearchParams(newParams)
  }, [filters, initialFilters, setSearchParams])

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => {
    setFilters(initialFilters)
  }

  return { filters, updateFilter, resetFilters }
}
