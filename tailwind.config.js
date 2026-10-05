/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: { 900: "#0f1b2d", 700: "#33425b", 500: "#64748b", 300: "#cbd5e1" },
        aqua: { 50: "#eef7fb", 100: "#d6ecf5", 500: "#1d7fa8", 600: "#16688c", 700: "#115070" },
      },
    },
  },
  plugins: [],
};
