/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a0f1e',
          800: '#0d1321',
          700: '#111827',
          600: '#1a2235',
          500: '#1e293b',
        },
      },
    },
  },
  plugins: [],
};
