#!/usr/bin/env node

import { program } from "commander";
import { initializeProject, handleInitError } from "./init.js";
import {
	checkDependencies,
	showInstallInstructions,
	promptContinue,
} from "./deps.js";

program
	.name("devflow")
	.description(
		"DevFlow CLI - A command-line tool for installing DevFlow in your project.\n\n" +
			"Adds DevFlow agents, configuration, and documentation structure to your existing project.",
	)
	.version("0.1.0")
	.configureHelp({
		sortSubcommands: true,
		showGlobalOptions: true,
	});

program
	.command("init")
	.description("Install DevFlow in your project")
	.argument(
		"[folder]",
		"Target folder path (optional). If not provided, DevFlow will be installed in the current directory",
	)
	.option("--skip-deps", "Skip dependency checks")
	.addHelpText(
		"after",
		`
Examples:
  $ devflow init                    Install DevFlow in the current directory
  $ devflow init ./my-project       Install DevFlow in the 'my-project' folder
  $ devflow init --skip-deps        Skip dependency checks

After installation, the CLI will:
  • Clone the DevFlow template repository
  • Copy DevFlow folders (.claude, .devflow, docs, etc.) to your project
  • Ask for confirmation if files already exist
		`,
	)
	.action(async (folder?: string, options?: { skipDeps?: boolean }) => {
		try {
			// Check dependencies first
			// Commander.js converts --skip-deps to skipDeps in camelCase
			const skipDeps = options?.skipDeps === true;
			const depsResult = await checkDependencies(skipDeps);

			if (depsResult.hasErrors) {
				showInstallInstructions(depsResult);
				const shouldContinue = await promptContinue();
				if (!shouldContinue) {
					process.stdout.write("\n");
					process.exit(0);
				}
				process.stdout.write("\n");
			}

			await initializeProject({
				folder,
			});
		} catch (error: unknown) {
			handleInitError(error);
		}
	});

program.parse();
