/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        orbit: {
          950: '#070a12',
          900: '#0b0f19',
          850: '#0f1626',
          800: '#141d33',
          700: '#1e293b',
          600: '#334155',
          violet: '#8b5cf6',
          'violet-dark': '#7c3aed',
          cyan: '#06b6d4',
          blue: '#3b82f6',
        }
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
