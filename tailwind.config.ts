import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8f7f4',
          100: '#ece8df',
          300: '#b8ad9d',
          600: '#63594d',
          800: '#2a2723',
          900: '#191715'
        },
        bead: {
          coral: '#ec6f5e',
          mint: '#5abf9b',
          amber: '#e7a93b',
          violet: '#7c6bd6',
          sky: '#5ba7c9'
        }
      },
      boxShadow: {
        panel: '0 18px 50px rgb(25 23 21 / 0.10)'
      }
    }
  },
  plugins: []
} satisfies Config
