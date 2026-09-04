/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        netflix: '#e50914',
        // Identidad GhostStreamX (diseño del amigo)
        bg: '#08090C',
        surface: '#101319',
        'surface-2': '#171B22',
        spectral: '#7FE7D4',
        'spectral-dim': 'rgba(127,231,212,0.35)',
        violet: '#5B4FE0',
        'violet-bright': '#7A6FF5',
        dimtext: '#8890A0',
        rating: '#E3BE6B',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
