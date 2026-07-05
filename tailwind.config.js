/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        accent: "#F59E0B",
        success: "#10B981",
        wrong: "#EF4444",
      }
    },
  },
  plugins: [],
}
