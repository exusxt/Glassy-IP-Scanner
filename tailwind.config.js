/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        glassy: {
          bg: 'var(--glassy-bg)',
          panel: 'var(--glassy-panel)',
          panel2: 'var(--glassy-panel2)',
          deep: 'var(--glassy-deep)',
          border: 'var(--glassy-border)',
          borderlight: 'var(--glassy-borderlight)',
          accent: 'var(--glassy-accent)',
          accent2: 'var(--glassy-accent2)',
          good: 'var(--glassy-good)',
          warn: 'var(--glassy-warn)',
          bad: 'var(--glassy-bad)',
          muted: 'var(--glassy-muted)',
          text: 'var(--glassy-text)'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        glow: 'var(--glassy-glow)'
      }
    }
  },
  plugins: []
}
