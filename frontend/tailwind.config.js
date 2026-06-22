/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef3c7",
          100: "#fde68a",
          200: "#fcd34d",
          300: "#fbbf24",
          400: "#f59e0b",
          500: "#d97706",
          600: "#b45309",
          700: "#92400e",
        },
        game: {
          bg: "#1a1a2e",
          card: "#16213e",
          border: "#0f3460",
          accent: "#e94560",
          success: "#4ade80",
          warning: "#fbbf24",
        },
      },
      fontFamily: {
        game: ["'Fredoka One'", "cursive"],
        body: ["'Nunito'", "sans-serif"],
      },
      animation: {
        "bounce-in": "bounceIn 0.5s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "score-pop": "scorePop 0.6s ease-out",
      },
      keyframes: {
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(233, 69, 96, 0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(233, 69, 96, 0.8)" },
        },
        scorePop: {
          "0%": { transform: "scale(1) translateY(0)", opacity: "1" },
          "50%": { transform: "scale(1.5) translateY(-20px)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(-40px)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
