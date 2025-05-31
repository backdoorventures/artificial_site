module.exports = {
  content: [
    "./layouts/**/*.{html,js}",
    "./content/**/*.{md,html}",
    "./assets/**/*.{js,html}",
    "./*.html",
    "./**/*.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
}

