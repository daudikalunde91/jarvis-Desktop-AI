/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg: '#0b0f17',
          panel: '#111826',
          accent: '#3fd0ff',
        },
      },
    },
  },
  plugins: [],
};
