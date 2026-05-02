import { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import { showSuccessToast, showErrorToast } from '../utils/toast.js'
import {
  MessageCircle,
  Send,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Search,
  Plus,
  Archive,
  Star,
} from 'lucide-react'

export default function SupportPage() {
  const { merchantId } = useParams()
  const [activeTab, setActiveTab] = useState('chat')
  const [selectedChat, setSelectedChat] = useState(null)
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [tickets, setTickets] = useState([])
  const [faqs, setFaqs] = useState([])
  const [knowledgeBase, setKnowledgeBase] = useState([])
  const [showNewTicketModal, setShowNewTicketModal] = useState(false)
  const [newTicket, setNewTicket] = useState({ subject: '', category: '', priority: 'medium', description: '' })
  const [chatMessages, setChatMessages] = useState([])
  const [onlineStatus, setOnlineStatus] = useState(true)
  const chatEndRef = useRef(null)

  // Mock data - in production, these would come from API
  const mockChats = [
    { id: 1, customer: 'John Doe', lastMessage: 'When will my order arrive?', time: '2 min ago', unread: 2, status: 'active' },
    { id: 2, customer: 'Jane Smith', lastMessage: 'I want to cancel my order', time: '15 min ago', unread: 1, status: 'active' },
    { id: 3, customer: 'Mike Johnson', lastMessage: 'Thank you for the quick delivery!', time: '1 hour ago', unread: 0, status: 'resolved' },
  ]

  const mockMessages = [
    { id: 1, sender: 'customer', text: 'Hi, I need help with my order', time: '10:30 AM' },
    { id: 2, sender: 'merchant', text: 'Hello! I\'d be happy to help. What\'s your order number?', time: '10:31 AM' },
    { id: 3, sender: 'customer', text: 'It\'s #12345. When will it arrive?', time: '10:32 AM' },
    { id: 4, sender: 'merchant', text: 'Let me check that for you. Your order is out for delivery and should arrive within 30 minutes.', time: '10:33 AM' },
  ]

  const mockTickets = [
    { id: 1, subject: 'Late Delivery', customer: 'John Doe', status: 'open', priority: 'high', created: '2 hours ago', category: 'delivery' },
    { id: 2, subject: 'Wrong Item', customer: 'Jane Smith', status: 'in-progress', priority: 'medium', created: '5 hours ago', category: 'product' },
    { id: 3, subject: 'Refund Request', customer: 'Mike Johnson', status: 'resolved', priority: 'low', created: '1 day ago', category: 'payment' },
  ]

  const mockFaqs = [
    { id: 1, question: 'How long does delivery take?', answer: 'Delivery typically takes 30-45 minutes within our service area.', category: 'delivery', views: 245 },
    { id: 2, question: 'How do I cancel an order?', answer: 'You can cancel your order from the app within 5 minutes of placing it.', category: 'orders', views: 189 },
    { id: 3, question: 'What payment methods do you accept?', answer: 'We accept credit cards, debit cards, and mobile payments.', category: 'payment', views: 156 },
  ]

  const mockKnowledgeBase = [
    { id: 1, title: 'Complete Delivery Guide', category: 'delivery', views: 523, lastUpdated: '2 days ago' },
    { id: 2, title: 'Order Management Tutorial', category: 'orders', views: 412, lastUpdated: '1 week ago' },
    { id: 3, title: 'Payment Processing Explained', category: 'payment', views: 287, lastUpdated: '3 days ago' },
  ]

  useEffect(() => {
    setTickets(mockTickets)
    setFaqs(mockFaqs)
    setKnowledgeBase(mockKnowledgeBase)
    if (selectedChat) {
      setChatMessages(mockMessages)
    }
  }, [selectedChat])

  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage = {
        id: chatMessages.length + 1,
        sender: 'merchant',
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages([...chatMessages, newMessage])
      setMessage('')
      showSuccessToast('Message sent')
    }
  }

  const createTicket = () => {
    if (newTicket.subject && newTicket.description) {
      const ticket = {
        id: tickets.length + 1,
        ...newTicket,
        customer: 'New Customer',
        status: 'open',
        created: 'Just now'
      }
      setTickets([ticket, ...tickets])
      setShowNewTicketModal(false)
      setNewTicket({ subject: '', category: '', priority: 'medium', description: '' })
      showSuccessToast('Ticket created successfully')
    }
  }

  const updateTicketStatus = (ticketId, newStatus) => {
    setTickets(tickets.map(ticket => 
      ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
    ))
    showSuccessToast(`Ticket status updated to ${newStatus}`)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400'
      case 'low': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Customer Support</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage customer inquiries and support tickets</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${onlineStatus ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {onlineStatus ? 'Online' : 'Offline'}
              </span>
            </div>
            <button
              onClick={() => setOnlineStatus(!onlineStatus)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm"
            >
              {onlineStatus ? 'Go Offline' : 'Go Online'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-8 px-6">
          {['chat', 'tickets', 'faq', 'knowledge'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'faq' ? 'FAQ' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="h-full flex">
            {/* Chat List */}
            <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-surface">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div className="overflow-y-auto h-full">
                {mockChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedChat?.id === chat.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{chat.customer}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{chat.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{chat.lastMessage}</p>
                      {chat.unread > 0 && (
                        <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-white dark:bg-dark-surface">
              {selectedChat ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">{selectedChat.customer}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Active now</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                          <Phone className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'merchant' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.sender === 'merchant'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <p>{msg.text}</p>
                          <p className={`text-xs mt-1 ${
                            msg.sender === 'merchant' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {msg.time}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <button
                        onClick={sendMessage}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Select a conversation to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Support Tickets</h2>
              <button
                onClick={() => setShowNewTicketModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Ticket
              </button>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {ticket.subject}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">{ticket.customer}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100 capitalize">{ticket.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {ticket.created}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            {ticket.status === 'open' && (
                              <button
                                onClick={() => updateTicketStatus(ticket.id, 'in-progress')}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Start
                              </button>
                            )}
                            {ticket.status === 'in-progress' && (
                              <button
                                onClick={() => updateTicketStatus(ticket.id, 'resolved')}
                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                              >
                                Resolve
                              </button>
                            )}
                            <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Frequently Asked Questions</h2>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Add FAQ
              </button>
            </div>

            <div className="grid gap-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">{faq.question}</h3>
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                          {faq.category}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-3">{faq.answer}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>{faq.views} views</span>
                        <button className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
                          <Star className="w-4 h-4" />
                          Helpful
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        Edit
                      </button>
                      <button className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'knowledge' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Knowledge Base</h2>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Add Article
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {knowledgeBase.map((article) => (
                <div key={article.id} className="bg-white dark:bg-dark-surface rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                      {article.category}
                    </span>
                    <Archive className="w-4 h-4 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{article.title}</h3>
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>{article.views} views</span>
                    <span>Updated {article.lastUpdated}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create New Ticket</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select category</option>
                  <option value="delivery">Delivery</option>
                  <option value="product">Product</option>
                  <option value="payment">Payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-surface rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={createTicket}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
