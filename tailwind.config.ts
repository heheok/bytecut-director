import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        crimson: {
          400: '#dc2626',
          500: '#b91c1c',
          600: '#991b1b',
          700: '#7f1d1d',
        },
        surface: {
          50: '#1a1a1a',
          100: '#1e1e1e',
          200: '#252525',
          300: '#2a2a2a',
          400: '#333333',
          500: '#444444',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
