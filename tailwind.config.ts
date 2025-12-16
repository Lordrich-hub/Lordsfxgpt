import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0b1220",
        panel: "#0f172a",
        accent: "#5eead4",
        accent2: "#c084fc",
        muted: "#94a3b8",
        border: "#1e293b"
      },
      boxShadow: {
        glow: "0 10px 50px rgba(94, 234, 212, 0.15)"
      }
    }
  },
  plugins: []
};

export default config;
