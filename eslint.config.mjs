import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next.config.js",
      "postcss.config.js",
      "tailwind.config.ts",
      "vercel.json",
    ],
  },
  js.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...(nextPlugin.configs?.["core-web-vitals"]?.rules ?? {}),
    },
  },
];
