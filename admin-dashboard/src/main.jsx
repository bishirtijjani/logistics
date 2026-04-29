import React from 'react'
import ReactDOM from 'react-dom/client'
import { Merchant } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { store } from './store/store.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Merchant store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Merchant>
  </React.StrictMode>,
)
