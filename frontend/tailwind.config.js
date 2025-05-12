/** @type {import('tailwindcss').Config} */
export default {
  prefix: 'tw-',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./src/home/index.html",
    "./src/client/index.html",
    "./src/admin/index.html",
    "./src/miniapp/index.html",
    "./src/website/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 