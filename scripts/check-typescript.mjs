import typescript from "typescript";
import { typescriptCompatibilityError } from "./typescript-compatibility.mjs";

const error = typescriptCompatibilityError(typescript);
if (error) {
  console.error(error);
  process.exitCode = 1;
}
