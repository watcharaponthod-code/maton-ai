import type { Config } from "tailwindcss"
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn .3s ease-in",
        "slide-up": "slideUp .25s ease-out",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity:"0" }, "100%": { opacity:"1" } },
        slideUp: { "0%": { transform:"translateY(6px)", opacity:"0" }, "100%": { transform:"translateY(0)", opacity:"1" } },
      },
    },
  },
  plugins: [],
}
export default config
