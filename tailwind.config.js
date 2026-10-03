/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1B2A44", 950: "#0F1A2E", 900: "#14213A", 800: "#1B2A44", 700: "#2A3B5A", 600: "#3D4F70" },
        papel: { DEFAULT: "#F7F5F0", 200: "#EDEAE2", 300: "#DDD8CC" },
        ouro: { DEFAULT: "#C9A44C", 300: "#E2C987", 600: "#A8852F" },
      },
      fontFamily: {
        serif: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Archivo"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
