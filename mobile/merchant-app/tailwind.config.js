/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#EA580C',
        secondary: '#09090b',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        'surface-muted': '#F3F4F6',
        text: '#09090b',
        muted: '#6B7280',
        error: '#EF4444',
        success: '#10B981',
        brand: '#EA580C',
        dark: '#09090b',
      }
    },
  },
  plugins: [],
}
