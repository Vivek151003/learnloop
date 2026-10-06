/**
 * LearnLoop design tokens (NFR-1). See docs/design.md for the reasoning.
 * Direction: an exercise book. Warm paper, black ink, one pencil-yellow highlight,
 * red and green reserved for marking answers. Rules instead of shadows.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replace (not extend) the palette so off-system colours can't creep in.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',
      paper: { DEFAULT: '#F6F4EE', raised: '#FFFEFB', sunken: '#EFEBE2' },
      // ink.4 is for hairlines and icons only: it fails text contrast.
      ink: { DEFAULT: '#1C1B17', 2: '#57534A', 3: '#6B665D', 4: '#9A948A' },
      rule: { DEFAULT: '#E3DED2', strong: '#CDC6B6' },
      pencil: { DEFAULT: '#F2C230', soft: '#FBEFC4', deep: '#7A5800' },
      // Not `right`/`wrong`: `text-right` already means text-align in Tailwind.
      correct: { DEFAULT: '#276B43', soft: '#E6F1E9' },
      incorrect: { DEFAULT: '#B23A26', soft: '#F8E5E0' },
    },
    fontFamily: {
      sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      serif: ['"Source Serif 4 Variable"', 'Georgia', 'serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    borderRadius: { none: '0', sm: '3px', DEFAULT: '6px', md: '8px', full: '9999px' },
    extend: {
      fontSize: { '2xs': ['0.6875rem', { lineHeight: '1rem' }] },
      boxShadow: {
        // Tactile "key" buttons: a solid ledge instead of a blurred glow.
        key: '0 2px 0 0 #000000',
        'key-light': '0 2px 0 0 #CDC6B6',
        pop: '0 12px 32px -12px rgba(28,27,23,0.28)',
      },
    },
  },
  plugins: [],
};
