import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { typescriptCompatibilityError } from "../scripts/typescript-compatibility.mjs";

test("the installed TypeScript supports the Next.js config loader", () => {
  assert.equal(typescriptCompatibilityError(ts), null);
});

test("a TypeScript API without sys fails with actionable guidance", () => {
  assert.match(typescriptCompatibilityError({ version: "7.0.2" }), /npm ci/);
  assert.match(typescriptCompatibilityError({ version: "7.0.2" }), /Incompatible TypeScript/);
});
