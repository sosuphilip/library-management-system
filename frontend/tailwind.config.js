/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f7f3',
          100: '#deebe1',
          200: '#bfd6c6',
          300: '#97b8a4',
          400: '#6e9680',
          500: '#507a63',
          600: '#3e6450',
          700: '#345241',
          800: '#2c4336',
          900: '#26392f',
          950: '#101c16'
        },
        brass: {
          200: '#ecd9ad',
          300: '#e2c685',
          400: '#d3ad58',
          500: '#c2943a',
          600: '#a6772a',
          700: '#855c22',
          800: '#6b491b'
        },
        paper: '#faf6ee'
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
