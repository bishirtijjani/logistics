import { useLocation, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const breadcrumbMap = {
  '/dashboard': { label: 'Dashboard', parent: null },
  '/requests': { label: 'Requests', parent: '/dashboard' },
  '/merchants': { label: 'Merchants', parent: '/dashboard' },
  '/riders': { label: 'Riders', parent: '/dashboard' },
  '/pending-riders': { label: 'Pending Riders', parent: '/dashboard' },
  '/users': { label: 'Users', parent: '/dashboard' },
  '/transactions': { label: 'Transactions', parent: '/dashboard' },
  '/audit-logs': { label: 'Audit Logs', parent: '/dashboard' },
  '/settings': { label: 'Settings', parent: '/dashboard' },
}

export default function Breadcrumb() {
  const location = useLocation()
  const currentPath = location.pathname
  const currentBreadcrumb = breadcrumbMap[currentPath]

  if (!currentBreadcrumb || currentPath === '/dashboard') {
    return null
  }

  const breadcrumbs = []
  let current = currentBreadcrumb
  let path = currentPath

  while (current) {
    breadcrumbs.unshift({ label: current.label, path })
    if (current.parent) {
      path = current.parent
      current = breadcrumbMap[path]
    } else {
      current = null
    }
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
      <Link to="/dashboard" className="hover:text-primary-600 transition-colors">
        Home
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center space-x-2">
          <ChevronRight size={16} className="text-gray-400" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-primary-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
