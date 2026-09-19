/** @type {import('tailwindcss').Config} */
// ─────────────────────────────────────────────────────────────────────────────
// MEMEVOLUTION design tokens. Re-theme the entire app from this file.
// Rule of the system: 90% monochrome. Colour is reserved for fitness signal.
//   acid  = life / survival / positive delta
//   rust  = decay / extinction / negative delta
//   probe = the model's prediction (never an observation)
// ─────────────────────────────────────────────────────────────────────────────
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#08090A',
        carbon: '#0B0D0E',
        graphite: '#121517',
        ash: '#1B1F22',
        smoke: '#6B7076',
        bone: '#EDE8E0',
        acid: {
          DEFAULT: '#C7F04A',
          dim: '#8FAE33',
          deep: '#4A5C1C',
        },
        rust: {
          DEFAULT: '#C4502E',
          dim: '#8A3A21',
          deep: '#4A1F11',
        },
        probe: {
          DEFAULT: '#58B6C4',
          dim: '#3C7B85',
          deep: '#1C3B41',
        },
      },
      borderColor: {
        hairline: 'rgba(237, 232, 224, 0.08)',
        'hairline-strong': 'rgba(237, 232, 224, 0.16)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'lab': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        lab: '0.14em',
      },
      keyframes: {
        'specimen-pulse': {
          '0%, 100%': { opacity: '0.28', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.06)' },
        },
        'breathe': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.9' },
        },
        'resolve-in': {
          '0%': { opacity: '0', filter: 'blur(6px)', transform: 'translateY(4px)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        'blink': {
          '0%, 45%': { opacity: '1' },
          '50%, 95%': { opacity: '0.15' },
        },
      },
      animation: {
        'specimen-pulse': 'specimen-pulse 2s ease-in-out infinite',
        breathe: 'breathe 1.8s ease-in-out infinite',
        'resolve-in': 'resolve-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
        scan: 'scan 3.2s linear infinite',
        blink: 'blink 1.6s steps(1, end) infinite',
      },
    },
  },
  plugins: [],
}
