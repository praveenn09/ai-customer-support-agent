/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0b1736",
          800: "#11234d",
          700: "#1a336b",
        },
      },
    },
  },
  plugins: [],
};
