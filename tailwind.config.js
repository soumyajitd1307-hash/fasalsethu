/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'agri-green': {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        'agri-lime': {
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
        },
        'agri-earth': {
          100: '#fef3c7',
          200: '#fde68a',
          500: '#d97706',
          800: '#92400e',
        },
        'agri-sky': {
          100: '#e0f2fe',
          400: '#38bdf8',
          600: '#0284c7',
        },
      },
      fontFamily: {
        sans:    ['Inter',  'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter',     'sans-serif'],
      },
      transitionDuration: {
        '400': '400ms',
      },
      animation: {
        'sway':        'sway 3s ease-in-out infinite',
        'sway-slow':   'sway 5s ease-in-out infinite',
        'float':       'float 5s ease-in-out infinite',
        'float-slow':  'float 7s ease-in-out infinite',
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'shimmer':     'shimmer 3.5s linear infinite',
        'spin-slow':   'spin 35s linear infinite',
        'bounce-slow': 'bounce 3s infinite',
        'scroll-down': 'scrollDown 2s ease-in-out infinite',
        'fade-in-up':  'fadeInUp 0.6s ease-out',
        'scale-in':    'scaleIn 0.5s ease-out',
      },
      keyframes: {
        sway: {
          '0%, 100%': { transform: 'rotate(var(--lean-left, -4deg)) scaleY(1)' },
          '50%':      { transform: 'rotate(var(--lean-right, 4deg)) scaleY(1.03)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-16px)' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.3)' },
          '50%':      { boxShadow: '0 0 0 14px rgba(34,197,94,0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        fadeInUp: {
          '0%':   { transform: 'translateY(28px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',     opacity: '1' },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        scrollDown: {
          '0%, 100%': { transform: 'translateY(0)',  opacity: '1' },
          '50%':      { transform: 'translateY(8px)', opacity: '0.5' },
        },
      },
      boxShadow: {
        'green-glow':    '0 0 24px rgba(34,197,94,0.20)',
        'green-glow-lg': '0 0 48px rgba(34,197,94,0.25)',
        'card-hover':    '0 16px 40px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
}
