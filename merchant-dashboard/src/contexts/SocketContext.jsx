import { createContext, useContext } from 'react'
import { useSelector } from 'react-redux'
import { useWebSocket } from '../hooks/useWebSocket.js'

const SocketContext = createContext(null)

// Single Socket.io connection for the whole merchant session, mounted once in
// Layout. Previously OrdersPage instantiated useWebSocket itself, which meant
// the socket (and with it every live update, including notification:new for
// the bell badge) died the moment the merchant navigated to any other page -
// this lifts it to the route root so it survives across the dashboard.
export function SocketProvider({ children }) {
  const { user } = useSelector((state) => state.auth)
  const merchantId = user?.merchantId
  const socket = useWebSocket(merchantId)
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

export function useSocketContext() {
  const ctx = useContext(SocketContext)
  if (!ctx) {
    throw new Error('useSocketContext must be used within a SocketProvider')
  }
  return ctx
}
