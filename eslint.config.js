import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        Swal: "readonly"
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "varsIgnorePattern": "_phase" }] 
    }
  },
]);