/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0eefe",
          200: "#bae0fd",
          300: "#7cc5fb",
          400: "#36a8f6",
          500: "#0c8ce8",
          600: "#006fc6",
          700: "#0159a0",
          800: "#064c84",
          900: "#0b416d",
        },
      },
    },
  },
  plugins: [],
};
