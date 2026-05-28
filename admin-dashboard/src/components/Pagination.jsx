import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const pageNumbers = []
  // Show fewer page buttons on mobile to avoid overflow.
  const maxVisible = typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 5
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let endPage = Math.min(totalPages, startPage + maxVisible - 1)

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1)
  }

  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i)

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const btnBase = 'border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
      <div className="text-xs sm:text-sm text-muted dark:text-dark-muted text-center sm:text-left">
        Showing {startItem}–{endItem} of {totalItems}
      </div>

      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="px-3 py-2 border border-surface-muted dark:border-dark-surface-muted rounded-lg bg-surface dark:bg-dark-surface text-text dark:text-dark-text text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center ${btnBase}`}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft size={18} className="text-text dark:text-dark-text" />
          </button>

          {startPage > 1 && (
            <>
              <button onClick={() => onPageChange(1)} className={`px-3 py-2 ${btnBase} text-sm text-text dark:text-dark-text`}>1</button>
              {startPage > 2 && <span className="px-1 text-muted">…</span>}
            </>
          )}

          {pageNumbers.map((n) => (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`px-3 py-2 min-w-[40px] min-h-[40px] border rounded-lg text-sm ${
                currentPage === n
                  ? 'bg-primary text-white border-primary'
                  : 'border-surface-muted dark:border-dark-surface-muted text-text dark:text-dark-text hover:bg-surface-muted dark:hover:bg-dark-surface-muted'
              }`}
            >
              {n}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-1 text-muted">…</span>}
              <button onClick={() => onPageChange(totalPages)} className={`px-3 py-2 ${btnBase} text-sm text-text dark:text-dark-text`}>{totalPages}</button>
            </>
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center ${btnBase}`}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight size={18} className="text-text dark:text-dark-text" />
          </button>
        </div>
      </div>
    </div>
  )
}
