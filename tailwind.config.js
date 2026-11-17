/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0B1F3A',
        gold: '#B88A4A',
        cream: '#F6F3EC',
        danger: '#B3261E',
        ok: '#1B7F4B',
      },
      fontFamily: {
        ar: ['"Noto Naskh Arabic"', '"IBM Plex Sans Arabic"', 'serif'],
        latin: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(11,31,58,0.08)',
      },
    },
  },
  plugins: [],
};
