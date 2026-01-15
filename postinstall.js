#!/usr/bin/env node
import {
  checkDependencies,
  showInstallInstructions
} from "./dist/chunk-T4ROB7GN.js";

// src/postinstall.ts
async function main() {
  try {
    const result = await checkDependencies(false);
    if (result.hasErrors) {
      process.stdout.write("\n");
      showInstallInstructions(result);
      process.stdout.write(
        "\n\u26A0\uFE0F  Some dependencies are missing. Run 'devflow init' to set up a project.\n"
      );
      process.stdout.write(
        "   The command will prompt you to install missing dependencies.\n\n"
      );
    } else {
      process.stdout.write("\n");
      process.stdout.write("\u2705 All dependencies are installed!\n");
      process.stdout.write(
        "   Run 'devflow init' to create a new project.\n\n"
      );
    }
  } catch {
    process.stdout.write(
      "\n\u26A0\uFE0F  Could not check dependencies. Run 'devflow init' to verify.\n\n"
    );
  }
}
main();
