import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        navy: { 950: '#050b18', 900: '#0a0e1a', 800: '#0f1629' },
        surface: { DEFAULT: '#0f1629', raised: '#162035', border: '#1e2d47' },
      },
    },
  },
  plugins: [],
}

export default config
