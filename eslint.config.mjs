import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    // supabase/functions is Deno code for Supabase Edge Functions; it has its
    // own runtime and global types, so the Next.js lint config must skip it.
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/**"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
