/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // BoatBuild CRM Color System - Finance-grade, professional
        primary: {
          DEFAULT: '#0A2540',
          50: '#E8EDF3',
          100: '#C5D1E0',
          200: '#9EB4CC',
          300: '#7797B8',
          400: '#5A82A9',
          500: '#3D6D9A',
          600: '#2C5A84',
          700: '#1E466C',
          800: '#133354',
          900: '#0A2540',
        },
        secondary: {
          DEFAULT: '#00B4D8',
          50: '#E0F7FC',
          100: '#B3ECF7',
          200: '#80DFF2',
          300: '#4DD2ED',
          400: '#26C8E8',
          500: '#00B4D8',
          600: '#009DBD',
          700: '#0086A3',
          800: '#006F88',
          900: '#00586E',
        },
        success: {
          DEFAULT: '#2ECC71',
          50: '#E9FAF0',
          100: '#C8F2D9',
          500: '#2ECC71',
          600: '#27AE60',
          700: '#1E8449',
        },
        warning: {
          DEFAULT: '#F1C40F',
          50: '#FDF9E6',
          100: '#FCF3C3',
          500: '#F1C40F',
          600: '#D4AC0D',
          700: '#B7950B',
        },
        danger: {
          DEFAULT: '#E74C3C',
          50: '#FDEDEB',
          100: '#FADBD8',
          500: '#E74C3C',
          600: '#CB4335',
          700: '#A93226',
        },
        background: '#F8F9FA',
        text: {
          DEFAULT: '#1C1C1C',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'modal': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      }
    },
  },
  plugins: [],
}
