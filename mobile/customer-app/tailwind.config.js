/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#EA580C',    // Burnt Orange - actionable
        secondary: '#09090b',  // Charcoal/Deep Zinc - headers, key elements
        background: '#FAFAFA', // Matte white for the whole app
        surface: '#FFFFFF',    // Pure white for cards/modals
        'surface-muted': '#F3F4F6', // Soft grey for text inputs, borders
        text: '#09090b',       // Default charcoal text
        muted: '#6B7280',      // Muted description text
        error: '#EF4444',      // Validation
        success: '#10B981',    // Confirmed actions
        // Component-compat aliases
        brand: '#EA580C',
        dark: '#09090b',
      }
    },
  },
  plugins: [],
}

