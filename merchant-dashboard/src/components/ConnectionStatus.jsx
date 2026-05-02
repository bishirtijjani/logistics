import { Wifi, WifiOff, AlertCircle, RefreshCw } from 'lucide-react'

export default function ConnectionStatus({ isConnected, connectionStatus, onReconnect }) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500'
      case 'error':
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'reconnecting':
        return 'Reconnecting...'
      case 'error':
        return 'Connection Error'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Unknown'
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4" />
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'error':
      case 'disconnected':
        return <WifiOff className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      {getStatusIcon()}
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {getStatusText()}
      </span>
      {!isConnected && connectionStatus !== 'connecting' && connectionStatus !== 'reconnecting' && (
        <button
          onClick={onReconnect}
          className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          Reconnect
        </button>
      )}
    </div>
  )
}
