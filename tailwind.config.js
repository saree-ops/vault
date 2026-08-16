/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17121F',
        aubergine: '#241A30',
        'aubergine-light': '#2E2238',
        zari: '#C9A24B',
        'zari-bright': '#E0BE6A',
        ivory: '#F5F1E8',
        parchment: '#EDE7DA',
        muted: '#8A8172',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'ui-serif', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
