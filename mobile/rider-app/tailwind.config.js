/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: '#4F46E5', // Electric Indigo
        'brand-dark': '#3730A3',
        background: '#F9FAFB', // Deeper contrast white
        muted: '#9CA3AF',
        surface: '#F3F4F6', // Soft input background
        dark: '#111827', // Premium dark text
      }
    },
  },
  plugins: [],
}
