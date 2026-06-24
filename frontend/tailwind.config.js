/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef4ff",
          100: "#dbe7ff",
          200: "#b9ceff",
          300: "#8aaeff",
          400: "#5b86ff",
          500: "#3b63f6",
          600: "#2746dc",
          700: "#1f37b0",
          800: "#1c2f8a",
          900: "#162363",
        },
        accent: {
          violet:  "#8b5cf6",
          fuchsia: "#d946ef",
          teal:    "#14b8a6",
          amber:   "#f59e0b",
          rose:    "#f43f5e",
          emerald: "#10b981",
          sky:     "#0ea5e9",
        },
      },
      backgroundImage: {
        "gradient-brand":  "linear-gradient(135deg,#3b63f6 0%,#8b5cf6 55%,#d946ef 100%)",
        "gradient-sky":    "linear-gradient(135deg,#0ea5e9 0%,#3b63f6 100%)",
        "gradient-sunset": "linear-gradient(135deg,#f59e0b 0%,#f43f5e 100%)",
        "gradient-mint":   "linear-gradient(135deg,#10b981 0%,#14b8a6 100%)",
        "gradient-shell":  "linear-gradient(180deg,#1c2f8a 0%,#3b63f6 50%,#8b5cf6 100%)",
        "gradient-app":
          "radial-gradient(1200px 600px at 0% 0%, rgba(59,99,246,0.10), transparent 60%)," +
          "radial-gradient(1000px 500px at 100% 0%, rgba(217,70,239,0.10), transparent 60%)," +
          "radial-gradient(900px 500px at 50% 100%, rgba(20,184,166,0.10), transparent 60%)",
      },
      boxShadow: {
        glow: "0 10px 30px -10px rgba(59,99,246,0.45)",
        card: "0 4px 20px -8px rgba(15,23,42,0.12)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
