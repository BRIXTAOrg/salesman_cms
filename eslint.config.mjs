import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/no-unescaped-entities": "off",

      "@typescript-eslint/no-unused-vars": "warn",
      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-expressions": "warn",
      "no-unused-expressions": "off",

      "@next/next/no-img-element": "off",
    },
  },

  /*
   * BRIXTA_REACT_COMPILER_INTEROP_V1
   *
   * dnd-kit intentionally returns ref-bearing attributes,
   * listeners and setNodeRef from its hooks. React Compiler's
   * refs rule cannot currently model that API correctly.
   *
   * Keep this exception narrowly scoped to the drag/drop
   * visual builder instead of weakening lint globally.
   */
  {
    files: [
      "src/components/appliance/responsibility-visual-builder.tsx",
    ],
    rules: {
      "react-hooks/refs": "off",
    },
  },

  /*
   * These two builders choose among statically imported Lucide
   * icons via helper functions. The components themselves are
   * not dynamically declared; React Compiler simply cannot
   * prove that through the icon-selector helper.
   */
  {
    files: [
      "src/components/appliance/responsibilities-client.tsx",
      "src/components/appliance/responsibility-app-builder.tsx",
    ],
    rules: {
      "react-hooks/static-components": "off",
    },
  },

  globalIgnores([
    ".brixta-backups/**",
    "graphify-out/**",
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "public/**",
    "src/generated/prisma/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
