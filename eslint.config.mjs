// @ts-check
import js from "@eslint/js";
import next from "@next/eslint-plugin-next";

// Define your ESLint configuration
const config = [
  js.configs.recommended,
  {
    plugins: {
      "@next/next": next,
    },
  },
  { ignores: [".next/*"] }, // Ignore Next.js build files
];

export default config;
