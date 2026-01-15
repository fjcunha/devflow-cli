import { exec } from "node:child_process";
import { promisify } from "node:util";
import { output } from "./output.js";
import { question } from "./utils.js";

const execAsync = promisify(exec);

export interface DependencyCheckResult {
	hasErrors: boolean;
	missingCli: string[];
	missingWeb: string[];
	osId: string;
	osName: string;
}

export interface OSInfo {
	id: string;
	name: string;
}

// Detect OS
export async function detectOS(): Promise<OSInfo> {
	const platform = process.platform;

	if (platform === "darwin") {
		return { id: "macos", name: "macOS" };
	}

	if (platform === "win32") {
		return { id: "windows", name: "Windows" };
	}

	// For Linux, try to detect distribution
	try {
		const { stdout } = await execAsync(
			"cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || echo ''",
		);
		const content = stdout.toLowerCase();

		if (
			content.includes("ubuntu") ||
			content.includes("debian") ||
			content.includes("linuxmint") ||
			content.includes("pop")
		) {
			return { id: "ubuntu", name: "Ubuntu/Debian" };
		}
		if (content.includes("fedora")) {
			return { id: "fedora", name: "Fedora" };
		}
		if (
			content.includes("rhel") ||
			content.includes("centos") ||
			content.includes("rocky") ||
			content.includes("almalinux")
		) {
			return { id: "rhel", name: "RHEL/CentOS/Rocky" };
		}
		if (content.includes("arch") || content.includes("manjaro")) {
			return { id: "arch", name: "Arch Linux" };
		}
	} catch {
		// Fall through to generic Linux
	}

	return { id: "linux", name: "Linux" };
}

// Check if a command exists
async function commandExists(command: string): Promise<boolean> {
	try {
		if (process.platform === "win32") {
			await execAsync(`where ${command} >nul 2>&1`);
		} else {
			await execAsync(`command -v ${command} >/dev/null 2>&1`);
		}
		return true;
	} catch {
		return false;
	}
}

// Get version of a command
async function getVersion(
	command: string,
	versionFlag = "--version",
): Promise<string | null> {
	try {
		const { stdout } = await execAsync(`${command} ${versionFlag} 2>&1`);
		return stdout.trim();
	} catch {
		return null;
	}
}

// Check dependencies
export async function checkDependencies(
	skipDeps = false,
): Promise<DependencyCheckResult> {
	if (skipDeps) {
		return {
			hasErrors: false,
			missingCli: [],
			missingWeb: [],
			osId: "unknown",
			osName: "Unknown",
		};
	}

	const osInfo = await detectOS();
	const missingCli: string[] = [];
	const missingWeb: string[] = [];

	output.info("Checking dependencies...");
	process.stdout.write("\n");

	// Required: Git
	if (await commandExists("git")) {
		const version = await getVersion("git");
		const shortVersion = version ? version.split("\n")[0].substring(0, 20) : "";
		output.success(`Git: ${shortVersion}...`);
	} else {
		output.error("Git: not found");
		missingCli.push("git");
	}

	// Required: Claude Code CLI
	if (await commandExists("claude")) {
		output.success("Claude Code: installed");
	} else {
		output.warn("Claude Code: not found (npm i -g @anthropic-ai/claude-code)");
		missingCli.push("claude-code");
	}

	// Optional: Node.js (for Web IDE)
	if (await commandExists("node")) {
		const version = await getVersion("node");
		if (version) {
			const match = version.match(/v?(\d+)/);
			if (match) {
				const major = parseInt(match[1], 10);
				if (major >= 18) {
					output.success(`Node.js: ${version.split("\n")[0]}`);
				} else {
					output.warn(`Node.js: ${version.split("\n")[0]} (recommended 18+)`);
					missingWeb.push("nodejs-upgrade");
				}
			} else {
				output.success(`Node.js: ${version.split("\n")[0]}`);
			}
		}
	} else {
		output.warn("Node.js: not found (required for Web IDE)");
		missingWeb.push("nodejs");
	}

	// Optional: Python 3 (for Web IDE)
	if (await commandExists("python3")) {
		const version = await getVersion("python3");
		if (version) {
			output.success(
				`Python3: ${version.split("\n")[0].replace("Python ", "")}`,
			);
		}
	} else if (await commandExists("python")) {
		const version = await getVersion("python");
		if (version) {
			const match = version.match(/Python (\d+)/);
			if (match && parseInt(match[1], 10) >= 3) {
				output.success(
					`Python: ${version.split("\n")[0].replace("Python ", "")}`,
				);
			} else {
				output.warn(
					`Python: ${version.split("\n")[0].replace("Python ", "")} (Python 3 required)`,
				);
				missingWeb.push("python3");
			}
		}
	} else {
		output.warn("Python3: not found (required for Web IDE)");
		missingWeb.push("python3");
	}

	// Optional: GCC (for Web IDE)
	if (await commandExists("gcc")) {
		output.success("GCC: installed");
	} else {
		output.warn("GCC: not found (required for Web IDE)");
		missingWeb.push("gcc");
	}

	// Optional: Make (for Web IDE)
	if (await commandExists("make")) {
		output.success("Make: installed");
	} else {
		output.warn("Make: not found (required for Web IDE)");
		missingWeb.push("make");
	}

	process.stdout.write("\n");

	return {
		hasErrors: missingCli.length > 0 || missingWeb.length > 0,
		missingCli,
		missingWeb,
		osId: osInfo.id,
		osName: osInfo.name,
	};
}

// Show installation instructions
export function showInstallInstructions(result: DependencyCheckResult): void {
	if (!result.hasErrors) {
		output.success("All dependencies are installed!");
		process.stdout.write("\n");
		return;
	}

	output.warn("Missing dependencies:");
	process.stdout.write("\n");

	const { missingCli, missingWeb, osId } = result;

	// Show OS-specific installation commands
	if (missingWeb.length > 0) {
		switch (osId) {
			case "ubuntu":
				process.stdout.write("  # Install dependencies (Debian/Ubuntu):\n");
				process.stdout.write("  sudo apt-get update\n");
				process.stdout.write(
					"  sudo apt-get install -y build-essential python3 git\n",
				);
				process.stdout.write("\n");
				if (missingWeb.includes("nodejs") || missingCli.includes("nodejs")) {
					process.stdout.write("  # Node.js 20 LTS:\n");
					process.stdout.write(
						"  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n",
					);
					process.stdout.write("  sudo apt-get install -y nodejs\n");
					process.stdout.write("\n");
				}
				break;
			case "fedora":
				process.stdout.write("  # Install dependencies (Fedora):\n");
				process.stdout.write(
					"  sudo dnf groupinstall -y 'Development Tools'\n",
				);
				process.stdout.write("  sudo dnf install -y python3 git nodejs npm\n");
				process.stdout.write("\n");
				break;
			case "rhel":
				process.stdout.write("  # Install dependencies (RHEL/CentOS):\n");
				process.stdout.write(
					"  sudo dnf groupinstall -y 'Development Tools'\n",
				);
				process.stdout.write("  sudo dnf install -y python3 git\n");
				process.stdout.write("\n");
				process.stdout.write("  # Node.js 20 LTS:\n");
				process.stdout.write(
					"  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -\n",
				);
				process.stdout.write("  sudo dnf install -y nodejs\n");
				process.stdout.write("\n");
				break;
			case "arch":
				process.stdout.write("  # Install dependencies (Arch):\n");
				process.stdout.write(
					"  sudo pacman -S base-devel python git nodejs npm\n",
				);
				process.stdout.write("\n");
				break;
			case "macos":
				process.stdout.write("  # Install dependencies (macOS):\n");
				process.stdout.write("  xcode-select --install\n");
				process.stdout.write("  brew install node\n");
				process.stdout.write("\n");
				break;
			case "windows":
				process.stdout.write("  # Install dependencies (Windows):\n");
				process.stdout.write("  # Use WSL (Windows Subsystem for Linux)\n");
				process.stdout.write("  # PowerShell as Admin:\n");
				process.stdout.write("  wsl --install\n");
				process.stdout.write(
					"  # Then follow Debian/Ubuntu instructions in WSL\n",
				);
				process.stdout.write("\n");
				break;
			default:
				process.stdout.write(
					"  # Install manually: Node.js 18+, Python 3, GCC, Make, Git\n",
				);
				process.stdout.write("\n");
		}
	}

	// Claude Code installation
	if (missingCli.includes("claude-code")) {
		process.stdout.write("  # Claude Code:\n");
		process.stdout.write("  npm install -g @anthropic-ai/claude-code\n");
		process.stdout.write("  claude login\n");
		process.stdout.write("\n");
	}

	// Git installation
	if (missingCli.includes("git")) {
		switch (osId) {
			case "ubuntu":
				process.stdout.write("  # Git:\n");
				process.stdout.write("  sudo apt-get install -y git\n");
				process.stdout.write("\n");
				break;
			case "fedora":
			case "rhel":
				process.stdout.write("  # Git:\n");
				process.stdout.write("  sudo dnf install -y git\n");
				process.stdout.write("\n");
				break;
			case "arch":
				process.stdout.write("  # Git:\n");
				process.stdout.write("  sudo pacman -S git\n");
				process.stdout.write("\n");
				break;
			case "macos":
				process.stdout.write("  # Git:\n");
				process.stdout.write("  xcode-select --install\n");
				process.stdout.write("\n");
				break;
		}
	}

	if (missingCli.length > 0) {
		output.warn("⚠ Missing CLI dependencies. Agent installation may not work.");
	}
}

// Prompt user to continue
export async function promptContinue(): Promise<boolean> {
	process.stdout.write("\n");
	const answer = await question("Continue anyway? (y/n) ");
	return answer.toLowerCase().startsWith("y");
}
