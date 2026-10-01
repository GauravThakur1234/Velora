/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb', // Primary button color
          900: '#1e3a8a',
          950: '#0b132b', // Deep background/text
        },
        surface: {
          light: '#ffffff',
          muted: '#f8fafc',
          dark: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['System', 'sans-serif'], // In a real app, load Inter or SF Pro
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}