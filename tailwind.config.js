/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#071018",
          900: "#0b1622",
          850: "#0f1d2b",
          800: "#142536",
          700: "#22364b",
        },
        signal: {
          blue: "#4ea8ff",
          teal: "#2dd4bf",
          green: "#39d98a",
          amber: "#f59e0b",
          red: "#fb7185",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(78,168,255,.18), 0 24px 70px rgba(0,0,0,.28)",
      },
    },
  },
  plugins: [],
};
