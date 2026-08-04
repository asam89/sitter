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
        brand: {
          cream: "#F8F5EC",
          ink: "#234E48",
          teal: {
            DEFAULT: "#2D5C56",
            dark: "#1F4A44",
            light: "#4E7471",
          },
          blue: {
            DEFAULT: "#8598B5",
            light: "#AEBBD3",
            dark: "#6B7FA0",
          },
          coral: {
            DEFAULT: "#E97C5D",
            dark: "#D8663F",
            light: "#F2A184",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
