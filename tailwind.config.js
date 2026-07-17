/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08100e",
          900: "#0e1815",
          850: "#12201c",
          800: "#192a24",
          700: "#2a4037",
        },
        signal: {
          blue: "#7aa7c7",
          teal: "#9bc53d",
          green: "#9bc53d",
          amber: "#d7a84f",
          red: "#fb7185",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(155,197,61,.14), 0 24px 70px rgba(0,0,0,.28)",
      },
    },
  },
  plugins: [],
};
