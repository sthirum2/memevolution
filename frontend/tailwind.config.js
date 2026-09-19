/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
// MEMEVOLUTION theme. Everything visual comes from this file.
// Light, friendly, high contrast. Colour carries one meaning only:
//   win   = this meme spread and survived
//   dead  = this meme flopped and was eliminated
//   guess = the AI's prediction (not a real result)
// ─────────────────────────────────────────────────────────────────────────────
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F6F3',
        card: '#FFFFFF',
        ink: '#17171A',
        muted: '#71716B',
        line: '#E6E4DE',
        win: {
          DEFAULT: '#15A34A',
          soft: '#E7F6ED',
          deep: '#0E7A37',
        },
        dead: {
          DEFAULT: '#DB5C4C',
          soft: '#FCECEA',
        },
        guess: {
          DEFAULT: '#3B7DF6',
          soft: '#EAF1FE',
        },
        mid: {
          DEFAULT: '#E0A020',
          soft: '#FDF3E0',
        },
        agent: {
          DEFAULT: '#6D4AFF',
          soft: '#F0ECFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,23,26,0.04), 0 4px 16px rgba(23,23,26,0.06)',
        lift: '0 2px 4px rgba(23,23,26,0.05), 0 12px 32px rgba(23,23,26,0.10)',
        win: '0 0 0 3px rgba(21,163,74,0.14)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'pop-in': 'pop-in 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}
