export const exportToCSV = (data, filename, headers) => {
  if (!data || data.length === 0) {
    alert('No data to export')
    return
  }

  const csvHeaders = headers.join(',')
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      const escaped = ('' + (value ?? '')).replace(/"/g, '""')
      return `"${escaped}"`
    }).join(',')
  })

  const csvContent = [csvHeaders, ...csvRows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
