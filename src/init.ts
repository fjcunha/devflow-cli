import { exec } from "node:child_process";
import {
	rm,
	access,
	mkdir,
	cp,
	readdir,
	writeFile,
	readFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { output } from "./output.js";
import { question } from "./utils.js";

const execAsync = promisify(exec);

export const REPO_URL = "https://github.com/evolve-labs-cloud/devflow.git";

export interface InitOptions {
	folder?: string;
}

// Recursively copy directory
async function copyDirectory(source: string, target: string): Promise<void> {
	const entries = await readdir(source, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = join(source, entry.name);
		const targetPath = join(target, entry.name);

		if (entry.isDirectory()) {
			await mkdir(targetPath, { recursive: true });
			await copyDirectory(sourcePath, targetPath);
		} else {
			await cp(sourcePath, targetPath);
		}
	}
}

// Check for existing files/folders that would conflict
async function checkConflicts(targetPath: string): Promise<string[]> {
	const conflicts: string[] = [];

	// Check for the specific folders we'll copy
	const foldersToCheck = [".claude/commands/agents", ".devflow", "docs"];

	for (const folder of foldersToCheck) {
		const targetFolderPath = join(targetPath, folder);
		try {
			await access(targetFolderPath);
			conflicts.push(folder);
		} catch {
			// Folder doesn't exist, no conflict
		}
	}

	return conflicts;
}

// Copy only the required DevFlow folders
async function copyDevFlowFiles(
	tempPath: string,
	targetPath: string,
): Promise<void> {
	// Copy .claude/commands/agents
	const agentsSource = join(tempPath, ".claude", "commands", "agents");
	const agentsTarget = join(targetPath, ".claude", "commands", "agents");

	try {
		await access(agentsSource);
		await mkdir(join(targetPath, ".claude", "commands"), { recursive: true });
		// Remove existing if it exists
		try {
			await rm(agentsTarget, { recursive: true, force: true });
		} catch {
			// Ignore if doesn't exist
		}
		await mkdir(agentsTarget, { recursive: true });
		await copyDirectory(agentsSource, agentsTarget);
		output.success("Agents installed (.claude/commands/agents/)");
	} catch {
		output.warn("Could not copy .claude/commands/agents");
	}

	// Copy .devflow structure
	const devflowSource = join(tempPath, ".devflow");
	const devflowTarget = join(targetPath, ".devflow");

	try {
		await access(devflowSource);
		// Create .devflow structure
		await mkdir(join(devflowTarget, "agents"), { recursive: true });
		await mkdir(join(devflowTarget, "memory"), { recursive: true });
		await mkdir(join(devflowTarget, "sessions"), { recursive: true });

		// Copy project.yaml if it exists
		const projectYamlSource = join(devflowSource, "project.yaml");
		const projectYamlTarget = join(devflowTarget, "project.yaml");
		try {
			await access(projectYamlSource);
			await cp(projectYamlSource, projectYamlTarget);
		} catch {
			// Create empty project.yaml if it doesn't exist
			await writeFile(projectYamlTarget, "", "utf-8");
		}
		output.success("DevFlow structure created (.devflow/)");
	} catch {
		output.warn("Could not copy .devflow structure");
	}

	// Copy docs folder (if it doesn't exist in target)
	const docsSource = join(tempPath, "docs");
	const docsTarget = join(targetPath, "docs");

	try {
		await access(docsTarget);
		output.warn("docs/ folder already exists - keeping existing");
	} catch {
		// docs doesn't exist, copy it
		try {
			await access(docsSource);
			// Remove existing if it exists
			try {
				await rm(docsTarget, { recursive: true, force: true });
			} catch {
				// Ignore if doesn't exist
			}
			await mkdir(docsTarget, { recursive: true });
			await copyDirectory(docsSource, docsTarget);
			output.success("Documentation structure created (docs/)");
		} catch {
			output.warn("Could not copy docs/ folder");
		}
	}

	await mkdir(join(targetPath, "docs", "snapshots"), { recursive: true });
}

export async function initializeProject(options: InitOptions): Promise<void> {
	const { folder } = options;

	// Determine target path
	let targetPath: string;
	if (folder) {
		targetPath = resolve(process.cwd(), folder);
	} else {
		targetPath = process.cwd();
	}

	// Create target directory if it doesn't exist
	await mkdir(targetPath, { recursive: true });

	// Create temp folder inside target directory
	const tempFolderName = `.devflow-temp-${Date.now()}`;
	const tempPath = join(targetPath, tempFolderName);

	try {
		// Clone into temp folder
		const stopSpinner = output.spinner(`Cloning template repository...`);
		try {
			await execAsync(`git clone ${REPO_URL} "${tempPath}"`);
		} finally {
			stopSpinner();
		}
		output.success("Cloned template repository");

		// Check for conflicts before copying
		const conflicts = await checkConflicts(targetPath);

		if (conflicts.length > 0) {
			process.stdout.write("\n");
			output.warn(
				`The following DevFlow files/folders already exist in the target directory:`,
			);
			for (const conflict of conflicts) {
				process.stdout.write(`  - ${conflict}\n`);
			}
			process.stdout.write("\n");

			const answer = await question(
				"Do you want to continue and replace existing DevFlow files? (y/n) ",
			);

			if (!answer.toLowerCase().startsWith("y")) {
				output.error("Initialization cancelled.");
				process.exit(0);
			}
			process.stdout.write("\n");
		}

		// Copy only the required DevFlow files
		const stopSpinner2 = output.spinner("Installing DevFlow files...");
		try {
			await copyDevFlowFiles(tempPath, targetPath);
		} finally {
			stopSpinner2();
		}

		// Copy .gitignore (merge if exists)
		const gitignoreSource = join(tempPath, ".gitignore");
		const gitignoreTarget = join(targetPath, ".gitignore");

		try {
			await access(gitignoreSource);
			try {
				// Check if .gitignore already exists in target
				await access(gitignoreTarget);
				// Merge: append DevFlow .gitignore to existing one
				const existingContent = await readFile(gitignoreTarget, "utf-8");
				const devflowContent = await readFile(gitignoreSource, "utf-8");
				await writeFile(
					gitignoreTarget,
					`${existingContent}\n${devflowContent}`,
					"utf-8",
				);
				output.success(".gitignore updated (merged with DevFlow entries)");
			} catch {
				// .gitignore doesn't exist, copy it
				await cp(gitignoreSource, gitignoreTarget);
				output.success(".gitignore created");
			}
		} catch {
			// .gitignore doesn't exist in source, skip
		}
	} finally {
		// Clean up temp folder at the end
		const stopSpinner3 = output.spinner("Cleaning up temporary files...");
		try {
			await rm(tempPath, { recursive: true, force: true });
		} catch {
			// Ignore errors during cleanup
		} finally {
			stopSpinner3();
		}
		output.success("Temporary files cleaned up");
	}

	output.success(`DevFlow initialized${folder ? ` in ${folder}` : ""} 🚀`);
}

export function handleInitError(error: unknown): never {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "ENOENT" &&
		"message" in error &&
		typeof error.message === "string" &&
		error.message.includes("git")
	) {
		output.error("Git is not installed or not found in PATH.");
		process.exit(1);
	}
	const errorMessage =
		error && typeof error === "object" && "message" in error
			? String(error.message)
			: String(error);
	output.error(`Error initializing project: ${errorMessage}`);
	process.exit(1);
}
