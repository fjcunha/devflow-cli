import { exec, spawn } from "node:child_process";
import { rm, mkdir, cp, readdir, access, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { output } from "./output.js";
import { REPO_URL } from "./init.js";

const execAsync = promisify(exec);

const REMOTE_PACKAGE_JSON_URL =
	"https://raw.githubusercontent.com/evolve-labs-cloud/devflow/main/web/package.json";

interface VersionCheckResult {
	localVersion: string | null;
	remoteVersion: string | null;
	hasUpdate: boolean;
}

// Fetch remote package.json version from GitHub
async function getRemoteVersion(): Promise<string | null> {
	try {
		const response = await fetch(REMOTE_PACKAGE_JSON_URL);
		if (!response.ok) {
			return null;
		}
		const data = (await response.json()) as { version?: string };
		return data.version ?? null;
	} catch {
		return null;
	}
}

// Get local web/package.json version
async function getLocalVersion(webPath: string): Promise<string | null> {
	try {
		const packageJsonPath = join(webPath, "package.json");
		const content = await readFile(packageJsonPath, "utf-8");
		const data = JSON.parse(content) as { version?: string };
		return data.version ?? null;
	} catch {
		return null;
	}
}

// Compare versions (simple semver comparison)
function isNewerVersion(remote: string, local: string): boolean {
	const remoteParts = remote.split(".").map(Number);
	const localParts = local.split(".").map(Number);

	for (let i = 0; i < Math.max(remoteParts.length, localParts.length); i++) {
		const remotePart = remoteParts[i] ?? 0;
		const localPart = localParts[i] ?? 0;

		if (remotePart > localPart) return true;
		if (remotePart < localPart) return false;
	}

	return false;
}

// Check if there's an update available
async function checkForUpdate(webPath: string): Promise<VersionCheckResult> {
	const [localVersion, remoteVersion] = await Promise.all([
		getLocalVersion(webPath),
		getRemoteVersion(),
	]);

	const hasUpdate =
		localVersion !== null &&
		remoteVersion !== null &&
		isNewerVersion(remoteVersion, localVersion);

	return { localVersion, remoteVersion, hasUpdate };
}

// Run a command and stream output to stdout/stderr
function runCommand(
	command: string,
	args: string[],
	cwd: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: "inherit",
			shell: true,
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Command failed with exit code ${code}`));
			}
		});

		child.on("error", reject);
	});
}

// Get the installed package root directory (where the CLI is installed globally)
function getPackageRootDir(): string {
	// In ESM, we use import.meta.url to get the current file path
	const currentFilePath = fileURLToPath(import.meta.url);
	// Go up from dist/ide.js to the package root
	return dirname(dirname(currentFilePath));
}

// Check if a path exists
async function pathExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
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

export async function startIde(): Promise<void> {
	const packageRoot = getPackageRootDir();
	const webTargetPath = join(packageRoot, "web");

	// Check if web folder already exists, if not clone and set it up
	if (!(await pathExists(webTargetPath))) {
		await setupWebFolder(packageRoot, webTargetPath);
	} else {
		// Check for updates if web folder exists
		const versionCheck = await checkForUpdate(webTargetPath);
		if (versionCheck.hasUpdate) {
			output.warn(
				`New version available: ${versionCheck.remoteVersion} (current: ${versionCheck.localVersion})`,
			);
			output.info("Run 'devflow ide update' to update to the latest version\n");
		}
	}

	// Check if node_modules exists, if not run npm install
	const nodeModulesPath = join(webTargetPath, "node_modules");
	if (!(await pathExists(nodeModulesPath))) {
		output.info("Installing dependencies...");
		await runCommand("npm", ["install"], webTargetPath);
		output.success("Dependencies installed");
	}

	// Start the Next.js dev server
	output.info("Starting DevFlow IDE...");
	await runCommand("npm", ["run", "dev"], webTargetPath);
}

async function setupWebFolder(
	packageRoot: string,
	webTargetPath: string,
	replace = false,
): Promise<void> {
	const tempFolderName = `.devflow-ide-temp-${Date.now()}`;
	const tempPath = join(packageRoot, tempFolderName);

	try {
		// Clone repository into temp folder
		const stopSpinner = output.spinner("Cloning repository...");
		try {
			await execAsync(`git clone ${REPO_URL} "${tempPath}"`);
		} finally {
			stopSpinner();
		}
		output.success("Repository cloned");

		// Remove existing web folder if replacing
		if (replace) {
			const stopSpinnerRm = output.spinner("Removing existing web folder...");
			try {
				await rm(webTargetPath, { recursive: true, force: true });
			} finally {
				stopSpinnerRm();
			}
			output.success("Existing web folder removed");
		}

		// Copy web folder to package root
		const webSourcePath = join(tempPath, "web");
		const stopSpinner2 = output.spinner("Setting up web folder...");
		try {
			await mkdir(webTargetPath, { recursive: true });
			await copyDirectory(webSourcePath, webTargetPath);
		} finally {
			stopSpinner2();
		}
		output.success(`Web folder installed at ${webTargetPath}`);
	} finally {
		// Clean up temp folder
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
}

export async function updateIde(): Promise<void> {
	const packageRoot = getPackageRootDir();
	const webTargetPath = join(packageRoot, "web");

	// Check if web folder exists and compare versions
	if (await pathExists(webTargetPath)) {
		const versionCheck = await checkForUpdate(webTargetPath);

		if (!versionCheck.hasUpdate) {
			if (versionCheck.localVersion && versionCheck.remoteVersion) {
				output.success(
					`DevFlow IDE is already up to date (version ${versionCheck.localVersion})`,
				);
			} else {
				output.success("DevFlow IDE is already up to date");
			}
			return;
		}

		output.info(
			`Updating DevFlow IDE from ${versionCheck.localVersion} to ${versionCheck.remoteVersion}...`,
		);
	} else {
		output.info("Installing DevFlow IDE...");
	}

	await setupWebFolder(packageRoot, webTargetPath, true);
	output.success("DevFlow IDE updated successfully");
}

export function handleIdeError(error: unknown): never {
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
	output.error(`Error starting IDE: ${errorMessage}`);
	process.exit(1);
}
