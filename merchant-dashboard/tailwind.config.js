/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
          DEFAULT: '#EA580C',
        },
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
        // Dark mode colors
        'dark-background': '#09090b',
        'dark-surface': '#1a1a1a',
        'dark-surface-muted': '#2a2a2a',
        'dark-text': '#FAFAFA',
        'dark-muted': '#9CA3AF',
      },
    },
  },
  plugins: [],
}
