/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#06120d",
          900: "#0a1c15",
          850: "#123023",
          800: "#174235",
          700: "#245a45",
        },
        signal: {
          blue: "#40b9d6",
          teal: "#b7e33d",
          green: "#9ed83b",
          amber: "#f2b84b",
          red: "#fb5f72",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(183,227,61,.22), 0 18px 60px rgba(0,0,0,.34)",
      },
    },
  },
  plugins: [],
};
