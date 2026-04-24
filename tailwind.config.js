/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        sans: ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        black: 'var(--ink)',
        white: 'var(--paper)',
        ink: 'var(--ink)',
        paper: 'var(--paper)',
        muted: 'var(--muted)',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}
