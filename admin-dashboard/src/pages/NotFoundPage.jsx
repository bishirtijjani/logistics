import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface-muted dark:bg-dark-surface-muted flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-text dark:text-dark-text mt-4">Page Not Found</h2>
          <p className="text-muted dark:text-dark-muted mt-2 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved to a different location.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-surface-muted dark:border-dark-surface-muted rounded-lg hover:bg-surface-muted dark:hover:bg-dark-surface-muted transition-colors text-text dark:text-dark-text"
          >
            <ArrowLeft size={20} />
            Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Home size={20} />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
