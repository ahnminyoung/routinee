/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          DEFAULT: '#6366F1',
        },
        income: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
        },
        expense: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
        },
        transfer: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F9FAFB',
          dark: '#1C1C1E',
          'dark-secondary': '#2C2C2E',
        },
        border: {
          DEFAULT: '#E5E7EB',
          dark: '#3A3A3C',
        },
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          'dark-primary': '#F9FAFB',
          'dark-secondary': '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Pretendard-Regular'],
        medium: ['Pretendard-Medium'],
        semibold: ['Pretendard-SemiBold'],
        bold: ['Pretendard-Bold'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
