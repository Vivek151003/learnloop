/** Design tokens (NFR-1). Colours meet 4.5:1 contrast on their usual backgrounds (NFR-5). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
        },
        ink: { DEFAULT: '#0f172a', muted: '#475569', faint: '#64748b' },
        line: '#e2e8f0',
        surface: { DEFAULT: '#ffffff', sunken: '#f8fafc' },
        success: { bg: '#ecfdf5', fg: '#047857', line: '#a7f3d0' },
        danger: { bg: '#fef2f2', fg: '#b91c1c', line: '#fecaca' },
        warn: { bg: '#fffbeb', fg: '#b45309', line: '#fde68a' },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: { card: '14px' },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)' },
    },
  },
  plugins: [],
};
