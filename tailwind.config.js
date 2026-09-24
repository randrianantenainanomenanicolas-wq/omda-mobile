/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Palette officielle OMDA (tokens uniquement, jamais de hex dans les composants)
        omda: {
          green: '#2E7A46',
          'green-dark': '#205C35',
          ochre: '#C79A3B',
          'ochre-dark': '#A87E2C',
          black: '#1A1A1A',
          white: '#FFFFFF',
          cream: '#F5F4EF',
          border: '#DDD9CE',
          'text-gray': '#6B675E',
          error: '#B3261E',
          info: '#2E4A66',
        },
        // Tokens sémantiques de statut
        status: {
          success: '#2E7A46',
          pending: '#C79A3B',
          error: '#B3261E',
          info: '#2E4A66',
        },
      },
    },
  },
  plugins: [],
};
