import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // FAST official palette
        platinum: '#F6F8FA',
        silicon: '#C8CFD8',
        'light-steel': '#A1B0CF',
        steel: '#5F6672',
        graphite: '#2B2C2F',
        // Semantic
        canvas: '#F6F8FA',
        card: '#FFFFFF',
        'text-primary': '#2B2C2F',
        'text-muted': '#5F6672',
      },
      borderRadius: {
        card: '14px',
        inner: '12px',
      },
      boxShadow: {
        card: '0 12px 36px -18px rgba(43, 44, 47, 0.16)',
        'input-inner': 'inset 0 1px 2px rgba(43, 44, 47, 0.05)',
        button: '0 1px 1px rgba(43, 44, 47, 0.10)',
        'button-hover': '0 2px 4px rgba(43, 44, 47, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
