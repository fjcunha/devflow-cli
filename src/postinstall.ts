#!/usr/bin/env node

import { checkDependencies, showInstallInstructions } from "./deps.js";

async function main() {
	try {
		// Run dependency check (non-interactive)
		const result = await checkDependencies(false);

		if (result.hasErrors) {
			process.stdout.write("\n");
			showInstallInstructions(result);
			process.stdout.write(
				"\n⚠️  Some dependencies are missing. Run 'devflow init' to set up a project.\n",
			);
			process.stdout.write(
				"   The command will prompt you to install missing dependencies.\n\n",
			);
		} else {
			process.stdout.write("\n");
			process.stdout.write("✅ All dependencies are installed!\n");
			process.stdout.write(
				"   Run 'devflow init' to create a new project.\n\n",
			);
		}
	} catch {
		// Silently fail in postinstall - don't break the installation
		// Just log a simple message
		process.stdout.write(
			"\n⚠️  Could not check dependencies. Run 'devflow init' to verify.\n\n",
		);
	}
}

main();
