/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}","./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pilar: {
          cuerpo: '#FF5733',
          mente: '#33A1FF',
          productividad: '#FFC300',
          personal: '#8E44AD'
        }
      }
    },
  },
  plugins: [],
}