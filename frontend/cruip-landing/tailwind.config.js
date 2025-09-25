/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 品牌色配置
        brand: {
          // 浅色主色 #3388BB
          primary: {
            50: '#f0f8ff',
            100: '#e0f0fe',
            200: '#bae1fd',
            300: '#7cc8fc',
            400: '#36acf8',
            500: '#3388bb', // 主色
            600: '#2570a3',
            700: '#1f5a84',
            800: '#1e4c6e',
            900: '#1e405b',
            950: '#14293d',
          },
          // 深色强调 #881144
          accent: {
            50: '#fdf2f8',
            100: '#fce7f3',
            200: '#fbcfe8',
            300: '#f8a5d3',
            400: '#f472b6',
            500: '#881144', // 强调色
            600: '#7a0f3e',
            700: '#6b0d37',
            800: '#5c0b30',
            900: '#4d0929',
            950: '#3e0722',
          },
        },
        // 保持与现有蓝色兼容
        blue: {
          300: '#93c5fd',
          500: '#3388bb', // 使用品牌主色
          600: '#2570a3',
        },
      },
      backgroundImage: {
        'linear-to-t': 'linear-gradient(to top, var(--tw-gradient-stops))',
      },
      keyframes: {
        shine: {
          '0%': { backgroundPosition: '200% 0%' },
          '100%': { backgroundPosition: '-200% 0%' },
        },
      },
      animation: {
        shine: 'shine 5s linear infinite',
      },
    },
  },
  plugins: [],
}
