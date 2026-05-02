# Merchant Dashboard — MVP to Production Roadmap

This roadmap details all improvements needed to make the merchant dashboard 100% production-ready and state-of-the-art.

---

## 🎨 Styling Guidelines & Rules

### Core Principles
- **No hardcoded styles** - All styling must use Tailwind CSS classes
- **Dark mode support** - Every component must support both light and dark themes
- **Consistent design system** - Follow the established design patterns from the admin dashboard
- **Responsive first** - All components must work on mobile, tablet, and desktop

### Required UI Components
- **Toast notifications** - Use sonner or react-hot-toast for all feedback
- **Alerts & confirmations** - Modal dialogs for destructive actions
- **Loading states** - Skeleton screens and loading indicators
- **Empty states** - Helpful messages and CTAs when no data exists
- **Error boundaries** - Graceful error handling throughout the app

### Dark Mode Implementation
- Use `dark:` prefix for all dark mode styles
- Test every page in both light and dark modes
- Ensure all text, backgrounds, borders, and interactive elements are visible
- Persist theme preference in localStorage

### User Feedback Requirements
- **Success actions** - Toast notifications with checkmarks
- **Error states** - Clear error messages with recovery suggestions
- **Loading feedback** - Progress indicators for async operations
- **Form validation** - Real-time validation with helpful error messages
- **Confirmation dialogs** - For delete, cancel, or irreversible actions

### Component Standards
- **Consistent spacing** - Use Tailwind's spacing scale consistently
- **Typography hierarchy** - Maintain clear heading and text sizes
- **Color usage** - Use the primary color palette for branding
- **Interactive states** - Hover, focus, and active states for all buttons/links
- **Accessibility** - ARIA labels, keyboard navigation, screen reader support

### Code Quality Rules
- **No inline styles** - All styles must be Tailwind classes
- **Semantic HTML** - Use proper HTML5 elements
- **Component reusability** - Create reusable UI components
- **Consistent naming** - Follow established naming conventions
- **Performance** - Lazy loading and code splitting where appropriate

---

## Phase 0 — Critical Fixes (✅ COMPLETED)
### 0.1 Fix Application Structure
- [x] Replace App.jsx default Vite template with proper App component
- [x] Fix main.jsx line 25: Change <Merchant> to <Provider> from react-redux
- [x] Create proper App.jsx wrapper component
- [x] Move routing from main.jsx to App.jsx
- [x] Test that the application loads and routing works

### 0.2 Fix Broken Imports
- [x] Verify all Redux slices are properly exported
- [x] Verify all page components are properly imported
- [x] Test login flow works end-to-end
- [x] Test navigation between all pages

## Phase 1 — Core Functionality Fixes (✅ COMPLETED)
### 1.1 Analytics Page Real Data
#### Tasks
- [x] Remove hardcoded mock data from AnalyticsPage.jsx (lines 61-79)
- [x] Connect revenue chart to actual API data from salesSummary
- [x] Connect orders chart to actual API data from orderHistory
- [x] Add loading state for charts
- [x] Add error state for failed API calls
- [x] Add empty state when no data available

### 1.2 Dark Mode Support
#### Tasks
- [x] Create ThemeContext provider
- [x] Add dark mode toggle to Layout.jsx header
- [x] Add dark mode Tailwind classes to all pages:
  - [x] OrdersPage.jsx
  - [x] MenuPage.jsx
  - [x] EarningsPage.jsx
  - [x] AnalyticsPage.jsx
  - [x] SettingsPage.jsx
  - [x] LoginPage.jsx
  - [x] Layout.jsx
- [x] Persist theme preference in localStorage
- [x] Test all pages in both light and dark modes

### 1.3 Error Handling
#### Tasks
- [x] Create ErrorBoundary component
- [x] Wrap App component with ErrorBoundary
- [x] Add toast notification system (react-hot-toast)
- [x] Replace all console.error with proper error toasts
- [x] Add retry logic for failed API calls
- [x] Add global error handler for unhandled promises

### 1.4 Loading States
#### Tasks
- [x] Add loading skeletons to OrdersPage
- [x] Add loading skeletons to MenuPage
- [x] Add loading skeletons to EarningsPage
- [x] Add loading skeletons to AnalyticsPage
- [x] Add loading skeletons to SettingsPage
- [x] Ensure all async actions show loading indicators

## Phase 2 — Authentication & Security (✅ COMPLETED)

### 2.1 Password Management
- [x] Add password change form to SettingsPage
- [x] Add current password verification
- [x] Add password strength indicator
- [x] Add password confirmation field
- [x] Implement backend endpoint for password change
- [x] Add "forgot password" flow to LoginPage
- [x] Add email verification flow

### 2.2 Session Management
- [x] Add session timeout detection
- [x] Add auto-logout on inactivity (30 min)
- [x] Add "session expiring" warning modal
- [x] Add "stay logged in" button
- [x] Implement token refresh mechanism
- [x] Add logout on all devices functionality

### 2.3 Security Enhancements
- [x] Add account lockout after 5 failed login attempts
- [x] Add "remember me" checkbox to LoginPage
- [x] Implement 2FA (Two-Factor Authentication) support
- [x] Add login history to SettingsPage
- [x] Add IP-based location detection
- [x] Add device management (view/remove devices)
---

## Phase 3 — Orders Page Enhancements (✅ COMPLETED)

### 3.1 Real-time Updates
- [x] Add WebSocket connection for live order updates
- [x] Auto-refresh orders when new order comes in
- [x] Show connection status indicator
- [x] Play sound notification on new order
- [x] Add browser push notification support
- [x] Handle WebSocket reconnection

### 3.2 Search & Filtering
- [x] Add order search by order ID
- [x] Add order search by customer name
- [x] Add date range filter
- [x] Add amount range filter
- [ ] Add debounced search input
- [ ] Persist filters in URL query params

### 3.3 Order Actions
- [x] Add bulk accept/reject functionality
- [x] Add checkbox selection to orders table
- [x] Add bulk action confirmation modal
- [x] Add order cancellation by merchant
- [x] Add order modification capability
- [x] Add order notes/comments system
- [x] Add print order receipt button

### 3.4 Order Details
- [x] Add customer contact integration (call/message buttons)
- [x] Add order status timeline/history
- [x] Add delivery time estimation
- [x] Add rider assignment visibility
- [x] Add map with pickup/dropoff locations
- [x] Add order priority levels
- [x] Add special instructions display

### 3.5 Data Export
- [x] Add CSV export for orders
- [x] Add PDF export for order receipt
- [x] Add date range export
- [x] Add custom field selection for export
---

## Phase 4 — Menu/Products Page Enhancements (✅ COMPLETED)

### 4.1 Image Management
- [x] Add image upload functionality
- [x] Add image cropping/resizing
- [x] Add image preview
- [x] Add multiple image support
- [x] Add drag-and-drop image upload
- [x] Add image compression
- [x] Add image gallery view

### 4.2 Product Organization
- [x] Add product categories management
- [x] Add category CRUD operations
- [x] Add category filtering
- [x] Add product variants (size, color, etc.)
- [x] Add product modifiers/add-ons
- [x] Add product bundling/combos
- [x] Add product sorting options

### 4.3 Inventory Management
- [x] Add low stock alerts
- [x] Add stock deduction on order
- [x] Add stock reconciliation
- [x] Add inventory reports
- [x] Add bulk stock update
- [x] Add stock adjustment history

### 4.4 Product Analytics
- [x] Add best sellers tracking
- [x] Add product performance metrics
- [x] Add customer favorites
- [x] Add product views tracking
- [x] Add conversion rate per product

### 4.5 Data Management
- [x] Add bulk import products (CSV)
- [x] Add bulk export products
- [x] Add product duplication
- [x] Add product templates
---

## Phase 5 — Earnings/Wallet Page Enhancements

### 5.1 Transaction Details
- [x] Add detailed transaction breakdown
- [x] Add tax information display
- [x] Add commission breakdown per order
- [x] Add transaction notes
- [x] Add transaction receipts download

### 5.2 Payout Management
- [x] Add saved bank accounts management
- [ ] Add payout scheduling
- [ ] Add minimum withdrawal threshold configuration
- [x] Add withdrawal history with detailed receipts
- [x] Add payout status tracking with timeline
- [x] Add payout method selection

### 5.3 Financial Analytics
- [ ] Add earnings projections/forecasts
- [ ] Add period comparison (this month vs last month)
- [ ] Add revenue trends
- [ ] Add profit/loss analysis
- [ ] Add tax reports
- [ ] Add commission reports

### 5.4 Refund & Dispute Management
- [x] Add refund handling
- [x] Add dispute management
- [x] Add refund history
- [x] Add dispute resolution workflow

### 5.5 Data Export
- [x] Add CSV export for transactions
- [x] Add PDF export for statements
- [x] Add date range export
- [x] Add custom report generation
---

## Phase 6 — Analytics Page Enhancements

### 6.1 Real Data Integration
- [x] Remove all hardcoded mock data
- [x] Connect all charts to actual API endpoints
- [x] Add custom date range selection
- [x] Add real-time data refresh
- [x] Add data caching strategy

### 6.2 Advanced Analytics
- [x] Add product performance analysis
- [x] Add customer analytics (repeat customers, LTV)
- [x] Add peak hours analysis
- [x] Add conversion tracking
- [x] Add delivery zone performance
- [x] Add cancellation rate analysis
- [ ] Add average order value tracking
- [ ] Add customer retention metrics

### 6.3 Business Intelligence Dashboards
- [ ] Add executive summary dashboard
- [ ] Add comparative analytics (vs industry benchmarks)
- [ ] Add predictive insights
- [ ] Add custom KPI tracking
- [ ] Add drill-down reports
- [ ] Add anomaly detection
- [ ] Add trend forecasting

### 6.4 Reporting
- [x] Add report export (PDF, CSV)
- [ ] Add scheduled reports
- [x] Add custom report builder
- [ ] Add report templates
- [ ] Add email report delivery

### 6.5 Predictive Analytics
- [ ] Add demand forecasting
- [ ] Add inventory predictions
- [ ] Add revenue projections
- [ ] Add trend analysis
---

## Phase 7 — Settings Page Enhancements

### 7.1 Profile Management
- [ ] Add profile picture upload
- [ ] Add business logo upload
- [ ] Add banner image upload
- [ ] Add business hours management (multiple time slots)
- [ ] Add holiday/special hours
- [ ] Add business description rich text editor

### 7.2 Location & Delivery
- [ ] Add delivery radius/zone management
- [ ] Add delivery fee configuration per zone
- [ ] Add minimum order amount per zone
- [ ] Add delivery time estimates
- [ ] Add map-based zone editor

### 7.3 Payment Configuration
- [ ] Add payment method settings
- [ ] Add payment gateway integration
- [ ] Add cash on delivery toggle
- [ ] Add wallet payment toggle
- [ ] Add tax rate configuration
- [ ] Add service fee configuration
- [ ] Add multi-currency support
- [ ] Add currency conversion rates

### 7.4 Team Management
- [ ] Add staff member management
- [ ] Add role-based permissions
- [ ] Add staff activity tracking
- [ ] Add staff performance metrics

### 7.5 Integration Settings
- [ ] Add API key management
- [ ] Add webhook configuration
- [ ] Add webhook system for integrations
- [ ] Add third-party integrations (POS, accounting)
- [ ] Add ERP system integration
- [ ] Add social media links
- [ ] Add website URL

### 7.6 Notification Preferences
- [ ] Add SMS notification settings
- [ ] Add WhatsApp notification settings
- [ ] Add email notification settings
- [ ] Add browser push settings
- [ ] Add notification frequency controls
- [ ] Add notification templates

### 7.7 Business Configuration
- [ ] Add full internationalization (i18n) support
- [ ] Add language/locale settings
- [ ] Add timezone handling
- [ ] Add currency configuration
- [ ] Add terms & conditions
- [ ] Add privacy policy
- [ ] Add refund policy

### 7.8 White-label Customization
- [ ] Add custom color scheme configuration
- [ ] Add custom logo upload
- [ ] Add custom domain support
- [ ] Add custom CSS injection
- [ ] Add branded email templates
- [ ] Add branded mobile app options
---

## Phase 8 — UI/UX Polish

### 8.1 Responsive Design
- [ ] Test on all breakpoints (mobile, tablet, desktop)
- [ ] Add mobile menu improvements
- [ ] Add horizontal scroll to tables
- [ ] Adjust grid layouts for smaller screens
- [ ] Add touch-friendly interactions

### 8.2 Loading States
- [ ] Add skeleton screens for all pages
- [ ] Add shimmer effects
- [ ] Add progressive image loading
- [ ] Add optimistic UI updates

### 8.3 Empty States
- [ ] Add empty state illustrations
- [ ] Add helpful empty state messages
- [ ] Add call-to-action buttons in empty states
- [ ] Add onboarding flow for new merchants

### 8.4 Merchant Onboarding Flow
- [ ] Create guided setup wizard
- [ ] Add business profile setup step
- [ ] Add menu/products setup step
- [ ] Add payment setup step
- [ ] Add delivery zone setup step
- [ ] Add preview before publish
- [ ] Add skip for later option

### 8.5 Feedback & Notifications
- [ ] Add toast notifications for all actions
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add success animations
- [ ] Add error recovery suggestions
- [ ] Add progress indicators for long operations

### 8.6 Accessibility
- [ ] Add ARIA labels to all interactive elements
- [ ] Add keyboard navigation support
- [ ] Add focus management
- [ ] Add screen reader support
- [ ] Add color contrast compliance
- [ ] Add skip to content link

### 8.7 Performance
- [ ] Add lazy loading for routes
- [ ] Add code splitting
- [ ] Add image optimization
- [ ] Add virtual scrolling for long lists
- [ ] Add debouncing on search inputs
- [ ] Add request cancellation on unmount

### 8.8 PWA & Offline Support
- [ ] Add service worker
- [ ] Add manifest.json
- [ ] Add offline page
- [ ] Add offline data caching
- [ ] Add background sync
- [ ] Add install prompt
- [ ] Test PWA functionality
---

## Phase 9 — Advanced Features

### 9.1 Real-time Features
- [ ] Add live order tracking
- [ ] Add live sales counter
- [ ] Add live inventory updates
- [ ] Add live rider location tracking
- [ ] Add live chat with customers

### 9.2 Marketing Features
- [ ] Add promo code/discount management
- [ ] Add loyalty program management
- [ ] Add coupon generation
- [ ] Add flash sale management
- [ ] Add special offers scheduling

### 9.3 Customer Engagement
- [ ] Add customer reviews management
- [ ] Add customer feedback collection
- [ ] Add customer segmentation
- [ ] Add targeted promotions
- [ ] Add customer communication tools

## Phase 10 — Developer API & Webhooks


## Priority Order

1. **Phase 0** (Critical Fixes) - App won't work without these
2. **Phase 1** (Core Functionality) - Basic usability
3. **Phase 2** (Authentication) - Security essentials
4. **Phase 3-7** (Feature Enhancements) - Production features
5. **Phase 8** (UI/UX) - User experience
6. **Phase 9** (Advanced Features) - Competitive advantage
7. **Phase 10-12** (Developer & Business Features) - Platform growth

---

## Notes

- Each phase should be completed and tested before moving to the next
- Use feature flags for experimental features
- Maintain backward compatibility when possible
- Update this roadmap as items are completed
- Regularly review and adjust priorities based on business needs
- Some phases can be worked on in parallel by different teams
- Critical security items should be prioritized above all else