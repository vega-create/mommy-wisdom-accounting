import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 智慧媽咪品牌色彩系統 (Based on Logo)
        brand: {
          // 主色 - 深酒紅 (Logo 主要顏色)
          primary: {
            50: '#FEF2F2',
            100: '#FEE2E2',
            200: '#FECACA',
            300: '#FCA5A5',
            400: '#EF8997',  // Logo 淺粉紅
            500: '#DC2626',
            600: '#BF1730',  // Logo 中紅
            700: '#A31621',  // Logo 深酒紅 (主色)
            800: '#931226',
            900: '#7F1D1D',
            950: '#450A0A',
          },
          // 輔色 - 溫暖粉紅
          secondary: {
            50: '#FFF5F5',
            100: '#FED7D7',
            200: '#FEB2B2',
            300: '#FC8181',
            400: '#F56565',
            500: '#E53E3E',
            600: '#C53030',
            700: '#9B2C2C',
            800: '#822727',
            900: '#63171B',
          },
          // 強調色 - 玫瑰金
          accent: {
            light: '#FECDD3',
            DEFAULT: '#EF8997',
            dark: '#BE123C',
          },
        },
      },
      backgroundImage: {
        // 品牌漸層 (模擬 Logo 的漸層效果)
        'brand-gradient': 'linear-gradient(135deg, #A31621 0%, #BF1730 50%, #EF8997 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #FEE2E2 0%, #FFF5F5 100%)',
        'brand-gradient-vertical': 'linear-gradient(180deg, #A31621 0%, #EF8997 100%)',
      },
      boxShadow: {
        'brand': '0 4px 14px 0 rgba(163, 22, 33, 0.25)',
        'brand-lg': '0 10px 40px 0 rgba(163, 22, 33, 0.3)',
      },
    },
  },
  plugins: [],
};
export default config;
