/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas:  'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink:     'rgb(var(--color-ink) / <alpha-value>)',
        muted:   'rgb(var(--color-muted) / <alpha-value>)',
        accent:  'rgb(var(--color-accent) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Outfit Variable"', 'Outfit', '"Segoe UI"', 'system-ui', 'sans-serif'],
        sans:    ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      boxShadow: {
        brutal:    'var(--shadow-brutal)',
        'brutal-sm': 'var(--shadow-brutal-sm)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out both',
        'slide-down': 'slideDown 0.3s ease-out both',
        'scale-in':   'scaleIn 0.2s ease-out both',
        'pulse-dot':  'pulseDot 2s ease-in-out infinite',
        'spin-slow':  'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
      },
    },
  },
  plugins: [],
}
