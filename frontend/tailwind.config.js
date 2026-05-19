/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: 'var(--color-dark-bg)',
          bg2: 'var(--color-dark-bg2)',
          card: 'var(--color-dark-card)',
          text: 'var(--color-dark-text)',
          muted: 'var(--color-dark-muted)',
          line: 'var(--color-dark-line)',
          nav: 'var(--color-dark-nav)',
          cardSoft: 'var(--color-dark-card-soft)',
          pill: 'var(--color-dark-pill)',
        },
        brand: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          deep: '#1E3A8A',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '22px',
      }
    },
  },
  plugins: [],
}
