/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#f5f7fb',
        primary: '#2563eb',
        accent: '#22d3ee'
      },
      boxShadow: {
        card: '0 10px 40px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
