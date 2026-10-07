/**
 * LearnLoop design tokens (NFR-1). See docs/design.md.
 * A conventional product UI: neutral grays, one blue brand colour, semantic
 * green/red/amber used only for state. The default Tailwind palette is replaced
 * so off-system colours can't creep in.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',
      gray: {
        25: '#FCFCFD',
        50: '#F9FAFB',
        100: '#F2F4F7',
        200: '#E4E7EC',
        300: '#D0D5DD',
        400: '#98A2B3',
        500: '#667085',
        600: '#475467',
        700: '#344054',
        800: '#1D2939',
        900: '#101828',
      },
      brand: {
        50: '#EFF4FF',
        100: '#DCE7FF',
        200: '#B8CEFF',
        500: '#3D6CF0',
        600: '#2457E6',
        700: '#1B45BF',
      },
      success: { 50: '#ECFDF3', 100: '#D1FADF', 500: '#17B26A', 600: '#067647', 700: '#05603A' },
      danger: { 50: '#FEF3F2', 100: '#FEE4E2', 500: '#F04438', 600: '#D92D20', 700: '#B42318' },
      warning: { 50: '#FFFAEB', 100: '#FEF0C7', 500: '#F79009', 600: '#B54708', 700: '#93370D' },
    },
    fontFamily: {
      // System fonts: SF Pro on macOS/iOS, Segoe UI on Windows, Roboto on Android.
      sans: [
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    borderRadius: {
      none: '0',
      sm: '4px',
      DEFAULT: '6px',
      md: '8px',
      lg: '10px',
      xl: '12px',
      full: '9999px',
    },
    extend: {
      boxShadow: {
        xs: '0 1px 2px rgba(16,24,40,0.05)',
        sm: '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)',
        lg: '0 12px 24px -4px rgba(16,24,40,0.12), 0 4px 8px -2px rgba(16,24,40,0.05)',
        focus: '0 0 0 4px rgba(36,87,230,0.18)',
      },
      keyframes: {
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'slide-up': 'slide-up 180ms ease-out', 'toast-in': 'toast-in 160ms ease-out' },
    },
  },
  plugins: [],
};
