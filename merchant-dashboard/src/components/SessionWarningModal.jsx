import { Clock, LogOut, User } from 'lucide-react'

export default function SessionWarningModal({ 
  show, 
  timeLeft, 
  formatTime, 
  onStayLoggedIn, 
  onLogout,
  isRefreshing 
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
            <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Session Expiring Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Your session will expire in
          </p>
        </div>

        <div className="mb-6">
          <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 text-center mb-2">
            {formatTime(timeLeft)}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className="bg-orange-600 dark:bg-orange-400 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${(timeLeft / (5 * 60 * 1000)) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onStayLoggedIn}
            disabled={isRefreshing}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRefreshing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Extending Session...
              </>
            ) : (
              <>
                <User className="w-5 h-5" />
                Stay Logged In
              </>
            )}
          </button>
          
          <button
            onClick={onLogout}
            className="w-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Log Out Now
          </button>
        </div>

        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-xs text-orange-600 dark:text-orange-400">
            For security reasons, your session automatically expires after 30 minutes of inactivity.
          </p>
        </div>
      </div>
    </div>
  )
}
