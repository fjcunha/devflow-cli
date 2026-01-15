import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	detectOS,
	checkDependencies,
	showInstallInstructions,
	promptContinue,
} from "./deps.js";
import { output } from "./output.js";
import { question } from "./utils.js";

// Create a shared mock execAsync function using vi.hoisted
const { mockExecAsync } = vi.hoisted(() => {
	const execAsync = vi.fn();
	return { mockExecAsync: execAsync };
});

// Mock modules - must be hoisted
vi.mock("node:child_process");
vi.mock("node:util", async () => {
	const actual = await vi.importActual("node:util");
	return {
		...actual,
		promisify: vi.fn((_fn) => mockExecAsync),
	};
});
vi.mock("./output.js", () => ({
	output: {
		info: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		spinner: vi.fn(() => vi.fn()),
	},
}));
vi.mock("./utils.js", () => ({
	question: vi.fn().mockResolvedValue("y"),
}));

describe("detectOS", () => {
	const originalPlatform = process.platform;
	const mockStdoutWrite = vi.spyOn(process.stdout, "write");

	beforeEach(() => {
		vi.clearAllMocks();
		mockStdoutWrite.mockImplementation(() => true);
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
			writable: true,
		});
		vi.restoreAllMocks();
	});

	it("should detect macOS", async () => {
		Object.defineProperty(process, "platform", {
			value: "darwin",
			writable: true,
		});

		const result = await detectOS();

		expect(result.id).toBe("macos");
		expect(result.name).toBe("macOS");
	});

	it("should detect Windows", async () => {
		Object.defineProperty(process, "platform", {
			value: "win32",
			writable: true,
		});

		const result = await detectOS();

		expect(result.id).toBe("windows");
		expect(result.name).toBe("Windows");
	});

	it("should detect Ubuntu/Debian", async () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});

		mockExecAsync.mockResolvedValue({
			stdout: "ID=ubuntu\nNAME=Ubuntu",
			stderr: "",
		});

		const result = await detectOS();

		expect(result.id).toBe("ubuntu");
		expect(result.name).toBe("Ubuntu/Debian");
	});

	it("should detect Fedora", async () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});

		mockExecAsync.mockResolvedValue({
			stdout: "ID=fedora\nNAME=Fedora",
			stderr: "",
		});

		const result = await detectOS();

		expect(result.id).toBe("fedora");
		expect(result.name).toBe("Fedora");
	});

	it("should detect RHEL/CentOS", async () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});

		mockExecAsync.mockResolvedValue({
			stdout: "ID=rhel\nNAME=Red Hat Enterprise Linux",
			stderr: "",
		});

		const result = await detectOS();

		expect(result.id).toBe("rhel");
		expect(result.name).toBe("RHEL/CentOS/Rocky");
	});

	it("should detect Arch Linux", async () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});

		mockExecAsync.mockResolvedValue({
			stdout: "ID=arch\nNAME=Arch Linux",
			stderr: "",
		});

		const result = await detectOS();

		expect(result.id).toBe("arch");
		expect(result.name).toBe("Arch Linux");
	});

	it("should fall back to generic Linux if detection fails", async () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});

		mockExecAsync.mockRejectedValue(new Error("Command failed"));

		const result = await detectOS();

		expect(result.id).toBe("linux");
		expect(result.name).toBe("Linux");
	});

	it("should fall back to generic Linux if os-release is empty", async () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});

		mockExecAsync.mockResolvedValue({
			stdout: "",
			stderr: "",
		});

		const result = await detectOS();

		expect(result.id).toBe("linux");
		expect(result.name).toBe("Linux");
	});
});

describe("checkDependencies", () => {
	const mockStdoutWrite = vi.spyOn(process.stdout, "write");
	const originalPlatform = process.platform;

	beforeEach(() => {
		vi.clearAllMocks();
		mockStdoutWrite.mockImplementation(() => true);
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
		});
		mockExecAsync.mockRejectedValue(new Error("Command not found"));
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
			writable: true,
		});
		vi.restoreAllMocks();
	});

	it("should skip dependency checks when skipDeps is true", async () => {
		const result = await checkDependencies(true);

		expect(result.hasErrors).toBe(false);
		expect(result.missingCli).toEqual([]);
		expect(result.missingWeb).toEqual([]);
		expect(result.osId).toBe("unknown");
		expect(result.osName).toBe("Unknown");
		expect(output.info).not.toHaveBeenCalled();
	});

	it("should detect all dependencies as installed", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("git --version")) {
				return Promise.resolve({ stdout: "git version 2.40.0", stderr: "" });
			}
			if (cmd.includes("node --version")) {
				return Promise.resolve({ stdout: "v20.0.0", stderr: "" });
			}
			if (cmd.includes("python3 --version")) {
				return Promise.resolve({ stdout: "Python 3.11.0", stderr: "" });
			}
			// All commands exist (command -v checks)
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.hasErrors).toBe(false);
		expect(result.missingCli).toEqual([]);
		expect(result.missingWeb).toEqual([]);
		expect(output.info).toHaveBeenCalledWith("Checking dependencies...");
	});

	it("should detect missing Git", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v git")) {
				return Promise.reject(new Error("Command not found"));
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingCli).toContain("git");
		expect(result.hasErrors).toBe(true);
		expect(output.error).toHaveBeenCalledWith("Git: not found");
	});

	it("should detect missing Claude Code", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v claude")) {
				return Promise.reject(new Error("Command not found"));
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingCli).toContain("claude-code");
		expect(result.hasErrors).toBe(true);
		expect(output.warn).toHaveBeenCalledWith(
			expect.stringContaining("Claude Code: not found"),
		);
	});

	it("should detect Node.js version 18+ as valid", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v node")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			if (cmd.includes("node --version")) {
				return Promise.resolve({ stdout: "v18.5.0", stderr: "" });
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingWeb).not.toContain("nodejs");
		expect(result.missingWeb).not.toContain("nodejs-upgrade");
		expect(output.success).toHaveBeenCalledWith(
			expect.stringContaining("Node.js:"),
		);
	});

	it("should detect Node.js version < 18 as needing upgrade", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v node")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			if (cmd.includes("node --version")) {
				return Promise.resolve({ stdout: "v16.20.0", stderr: "" });
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingWeb).toContain("nodejs-upgrade");
		expect(output.warn).toHaveBeenCalledWith(
			expect.stringContaining("recommended 18+"),
		);
	});

	it("should detect missing Node.js", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v node")) {
				return Promise.reject(new Error("Command not found"));
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingWeb).toContain("nodejs");
		expect(output.warn).toHaveBeenCalledWith(
			expect.stringContaining("Node.js: not found"),
		);
	});

	it("should prefer python3 over python", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v python3")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			if (cmd.includes("python3 --version")) {
				return Promise.resolve({ stdout: "Python 3.11.0", stderr: "" });
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingWeb).not.toContain("python3");
		expect(output.success).toHaveBeenCalledWith(
			expect.stringContaining("Python3:"),
		);
	});

	it("should detect Python 2 as invalid", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v python3")) {
				return Promise.reject(new Error("Command not found"));
			}
			if (cmd.includes("command -v python")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			if (cmd.includes("python --version")) {
				return Promise.resolve({ stdout: "Python 2.7.18", stderr: "" });
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingWeb).toContain("python3");
		expect(output.warn).toHaveBeenCalledWith(
			expect.stringContaining("Python 3 required"),
		);
	});

	it("should detect missing GCC and Make", async () => {
		mockExecAsync.mockImplementation((cmd: string) => {
			if (cmd.includes("cat /etc/os-release")) {
				return Promise.resolve({ stdout: "ID=ubuntu", stderr: "" });
			}
			if (cmd.includes("command -v gcc") || cmd.includes("command -v make")) {
				return Promise.reject(new Error("Command not found"));
			}
			// Other commands exist
			return Promise.resolve({ stdout: "", stderr: "" });
		});

		const result = await checkDependencies(false);

		expect(result.missingWeb).toContain("gcc");
		expect(result.missingWeb).toContain("make");
	});
});

describe("showInstallInstructions", () => {
	const mockStdoutWrite = vi.spyOn(process.stdout, "write");

	beforeEach(() => {
		vi.clearAllMocks();
		mockStdoutWrite.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should show success message when no errors", () => {
		const result = {
			hasErrors: false,
			missingCli: [],
			missingWeb: [],
			osId: "linux",
			osName: "Linux",
		};

		showInstallInstructions(result);

		expect(output.success).toHaveBeenCalledWith(
			"All dependencies are installed!",
		);
	});

	it("should show Ubuntu installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["gcc", "make"],
			osId: "ubuntu",
			osName: "Ubuntu/Debian",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Debian/Ubuntu"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("apt-get"),
		);
	});

	it("should show Node.js installation for Ubuntu when nodejs is missing", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["nodejs"],
			osId: "ubuntu",
			osName: "Ubuntu/Debian",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Node.js 20 LTS"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("nodesource.com"),
		);
	});

	it("should show Fedora installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["gcc"],
			osId: "fedora",
			osName: "Fedora",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Fedora"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("dnf"),
		);
	});

	it("should show RHEL installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["gcc"],
			osId: "rhel",
			osName: "RHEL/CentOS/Rocky",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("RHEL/CentOS"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Node.js 20 LTS"),
		);
	});

	it("should show Arch installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["gcc"],
			osId: "arch",
			osName: "Arch Linux",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Arch"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("pacman"),
		);
	});

	it("should show macOS installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["gcc"],
			osId: "macos",
			osName: "macOS",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("macOS"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("xcode-select"),
		);
	});

	it("should show Windows installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: [],
			missingWeb: ["gcc"],
			osId: "windows",
			osName: "Windows",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Windows"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("WSL"),
		);
	});

	it("should show Claude Code installation instructions", () => {
		const result = {
			hasErrors: true,
			missingCli: ["claude-code"],
			missingWeb: [],
			osId: "linux",
			osName: "Linux",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Claude Code"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("@anthropic-ai/claude-code"),
		);
	});

	it("should show Git installation instructions for Ubuntu", () => {
		const result = {
			hasErrors: true,
			missingCli: ["git"],
			missingWeb: [],
			osId: "ubuntu",
			osName: "Ubuntu/Debian",
		};

		showInstallInstructions(result);

		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("Git:"),
		);
		expect(mockStdoutWrite).toHaveBeenCalledWith(
			expect.stringContaining("apt-get install -y git"),
		);
	});

	it("should show warning when CLI dependencies are missing", () => {
		const result = {
			hasErrors: true,
			missingCli: ["git"],
			missingWeb: [],
			osId: "linux",
			osName: "Linux",
		};

		showInstallInstructions(result);

		expect(output.warn).toHaveBeenCalledWith(
			"⚠ Missing CLI dependencies. Agent installation may not work.",
		);
	});
});

describe("promptContinue", () => {
	const mockStdoutWrite = vi.spyOn(process.stdout, "write");
	const mockQuestion = vi.mocked(question);

	beforeEach(() => {
		vi.clearAllMocks();
		mockStdoutWrite.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should return true when user answers yes", async () => {
		mockQuestion.mockResolvedValueOnce("yes");

		const result = await promptContinue();

		expect(result).toBe(true);
		expect(mockQuestion).toHaveBeenCalledWith("Continue anyway? (y/n) ");
	});

	it("should return true when user answers y", async () => {
		mockQuestion.mockResolvedValueOnce("y");

		const result = await promptContinue();

		expect(result).toBe(true);
	});

	it("should return false when user answers no", async () => {
		mockQuestion.mockResolvedValueOnce("no");

		const result = await promptContinue();

		expect(result).toBe(false);
	});

	it("should return false when user answers n", async () => {
		mockQuestion.mockResolvedValueOnce("n");

		const result = await promptContinue();

		expect(result).toBe(false);
	});

	it("should handle case-insensitive input", async () => {
		mockQuestion.mockResolvedValueOnce("YES");

		const result = await promptContinue();

		expect(result).toBe(true);
	});

	it("should write newline before prompting", async () => {
		mockQuestion.mockResolvedValueOnce("y");

		await promptContinue();

		expect(mockStdoutWrite).toHaveBeenCalledWith("\n");
	});
});
