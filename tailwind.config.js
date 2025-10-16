/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './views/**/*.html',
    './src/client/**/*.js',
    './public/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#2563EB',
          700: '#1D4ED8'
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        neutral: {
          bg: '#F9FAFB',
          surface: '#FFFFFF',
          line: '#E5E7EB',
          text: '#111827',
          subtext: '#4B5563'
        }
      }
    }
  },
  plugins: []
};


