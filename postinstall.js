#!/usr/bin/env node

// Standalone postinstall script - does not depend on built dist/ files
// This runs after npm install to check if dependencies are available

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const isWindows = process.platform === "win32";

async function commandExists(command) {
	try {
		const checkCmd = isWindows ? `where ${command}` : `command -v ${command}`;
		await execAsync(checkCmd);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	try {
		const gitExists = await commandExists("git");
		const claudeExists = await commandExists("claude");

		if (!gitExists || !claudeExists) {
			process.stdout.write("\n");
			if (!gitExists) {
				process.stdout.write("⚠️  Git is not installed or not in PATH\n");
			}
			if (!claudeExists) {
				process.stdout.write("⚠️  Claude Code CLI is not installed or not in PATH\n");
			}
			process.stdout.write(
				"\n⚠️  Some dependencies are missing. Run 'devflow init' to set up a project.\n"
			);
			process.stdout.write(
				"   The command will prompt you to install missing dependencies.\n\n"
			);
		} else {
			process.stdout.write("\n");
			process.stdout.write("✅ All required dependencies are installed!\n");
			process.stdout.write("   Run 'devflow init' to create a new project.\n\n");
		}
	} catch {
		// Silently fail in postinstall - don't break the installation
		process.stdout.write(
			"\n⚠️  Could not check dependencies. Run 'devflow init' to verify.\n\n"
		);
	}
}

main();
