import { useLocation, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const breadcrumbMap = {
  '/dashboard': { label: 'Dashboard', parent: null },
  '/requests': { label: 'Dispatch', parent: '/dashboard' },
  '/merchants': { label: 'Merchants', parent: '/dashboard' },
  '/categories': { label: 'Categories', parent: '/dashboard' },
  '/riders': { label: 'Riders', parent: '/dashboard' },
  '/analytics': { label: 'Analytics', parent: '/dashboard' },
  '/financial': { label: 'Financial', parent: '/dashboard' },
  '/disputes': { label: 'Disputes', parent: '/dashboard' },
  '/support': { label: 'Support', parent: '/dashboard' },
  '/marketing': { label: 'Marketing', parent: '/dashboard' },
  '/waitlist': { label: 'Waitlist', parent: '/dashboard' },
  '/safety': { label: 'Safety', parent: '/dashboard' },
  '/vtu-plans': { label: 'VTU Plans', parent: '/dashboard' },
  '/vtu-networks': { label: 'VTU Networks', parent: '/dashboard' },
  '/customers': { label: 'Customers', parent: '/dashboard' },
  '/transactions': { label: 'Transactions', parent: '/dashboard' },
  '/audit-logs': { label: 'Audit Logs', parent: '/dashboard' },
  '/settings': { label: 'Settings', parent: '/dashboard' },
  '/profile': { label: 'Profile', parent: '/dashboard' },
}

const resolveBreadcrumb = (path) => {
  if (breadcrumbMap[path]) return breadcrumbMap[path]
  if (/^\/customers\/[^/]+$/.test(path)) return { label: 'Customer', parent: '/customers' }
  if (/^\/disputes\/[^/]+$/.test(path)) return { label: 'Dispute', parent: '/disputes' }
  if (/^\/support\/[^/]+$/.test(path)) return { label: 'Ticket', parent: '/support' }
  if (/^\/merchants\/[^/]+\/analytics$/.test(path)) return { label: 'Analytics', parent: '/merchants' }
  return null
}

export default function Breadcrumb() {
  const location = useLocation()
  const currentPath = location.pathname
  const currentBreadcrumb = resolveBreadcrumb(currentPath)

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
      current = resolveBreadcrumb(path)
    } else {
      current = null
    }
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted dark:text-dark-muted mb-6">
      <Link to="/dashboard" className="hover:text-primary transition-colors">
        Home
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center space-x-2">
          <ChevronRight size={16} className="text-muted dark:text-dark-muted" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-text dark:text-dark-text">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-primary transition-colors">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
