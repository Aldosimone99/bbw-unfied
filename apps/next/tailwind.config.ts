import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bronze: "#C9943A",
        champagne: "#E8C97E",
        ivory: "#F5EFE0",
        coffee: "#14110F"
      },
      fontFamily: {
        sans: ["Avenir Next", "Avenir", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
