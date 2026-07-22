/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // orange-Studio brand
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // dark surfaces matching oranges.lt (#161616)
        ink: {
          900: '#0f0f0f',
          850: '#141414',
          800: '#161616',
          750: '#1c1c1c',
          700: '#222222',
          600: '#2a2a2a',
          500: '#333333',
          400: '#444444',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'Arial', 'sans-serif'],
      },
      keyframes: {
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'scale-check': {
          '0%': { transform: 'scale(0.8)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'fade-out': 'fade-out 0.3s ease-out forwards',
        'scale-check': 'scale-check 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
