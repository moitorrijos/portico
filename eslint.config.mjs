import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma's generated client is machine-written TypeScript, several
    // thousand lines of it. Linting it reports style opinions about code
    // nobody edits, and it is regenerated on every build anyway.
    "lib/generated/**",
    // The esbuild bundle of scripts/seed.ts — a single 5 MB file with every
    // dependency inlined. ESLint's flat config does NOT read .gitignore, so
    // being gitignored is not enough to keep it out of the lint run; without
    // this line it contributes hundreds of findings about vendored code and
    // buries the handful that are actually ours.
    "dist-scripts/**",
  ]),
]);

export default eslintConfig;
