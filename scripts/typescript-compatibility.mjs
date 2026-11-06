/** Next 15's TypeScript config loader requires these legacy compiler APIs. */
export function typescriptCompatibilityError(typescript) {
  if (
    typeof typescript?.sys?.fileExists !== "function" ||
    typeof typescript?.findConfigFile !== "function"
  ) {
    return "Incompatible TypeScript version: Next.js 15 needs a compatible compiler API. Run npm ci to restore the version in package-lock.json (TypeScript 5); do not use npm audit fix --force.";
  }
  return null;
}
