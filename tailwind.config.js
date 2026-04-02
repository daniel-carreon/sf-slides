/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        morado: {
          50: "#f3f0ff",
          100: "#e9e0ff",
          200: "#d4c0ff",
          300: "#b894ff",
          400: "#9b68ff",
          500: "#8B5CF6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        ambar: {
          400: "#fbbf24",
          500: "#F59E0B",
          600: "#d97706",
        },
        slide: {
          bg: "#0f0f17",
          panel: "#141420",
          surface: "#1a1a2e",
          border: "#2a2a3e",
        },
      },
    },
  },
  plugins: [],
};
