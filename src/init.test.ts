import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PathLike } from "node:fs";
import {
	readFile,
	writeFile,
	rm,
	access,
	mkdir,
	cp,
	readdir,
} from "node:fs/promises";
import { initializeProject, handleInitError, REPO_URL } from "./init.js";
import { output } from "./output.js";
import { question } from "./utils.js";

// Create a shared mock execAsync function using vi.hoisted
const { mockExecAsync } = vi.hoisted(() => {
	const execAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
	return { mockExecAsync: execAsync };
});

// Mock modules - must be hoisted
vi.mock("node:fs/promises");
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
		spinner: vi.fn(() => vi.fn()), // Returns a stop function
	},
}));
vi.mock("./utils.js", () => ({
	question: vi.fn().mockResolvedValue("y"),
}));

describe("initializeProject", () => {
	const mockReadFile = vi.mocked(readFile);
	const mockWriteFile = vi.mocked(writeFile);
	const mockRm = vi.mocked(rm);
	const mockAccess = vi.mocked(access);
	const mockMkdir = vi.mocked(mkdir);
	const mockCp = vi.mocked(cp);
	const mockReaddir = vi.mocked(readdir);
	const mockQuestion = vi.mocked(question);

	beforeEach(() => {
		vi.clearAllMocks();
		// Default successful mocks
		mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
		mockMkdir.mockResolvedValue(undefined);
		mockCp.mockResolvedValue(undefined);
		mockRm.mockResolvedValue(undefined);
		mockWriteFile.mockResolvedValue(undefined);
		mockReaddir.mockResolvedValue([]);
		// Default: files don't exist (ENOENT)
		mockAccess.mockRejectedValue(new Error("ENOENT"));
		mockQuestion.mockResolvedValue("y");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("folder handling", () => {
		it("should create target directory if it doesn't exist", async () => {
			await initializeProject({
				folder: "test-folder",
			});

			expect(mockMkdir).toHaveBeenCalledWith(
				expect.stringContaining("test-folder"),
				{ recursive: true },
			);
		});

		it("should use current directory when folder is not provided", async () => {
			await initializeProject({});

			expect(mockMkdir).toHaveBeenCalledWith(expect.any(String), {
				recursive: true,
			});
		});
	});

	describe("git clone", () => {
		it("should clone repository to temp folder", async () => {
			await initializeProject({
				folder: "test-folder",
			});

			expect(mockExecAsync).toHaveBeenCalledWith(
				expect.stringContaining(`git clone ${REPO_URL}`),
			);
			expect(mockExecAsync).toHaveBeenCalledWith(
				expect.stringContaining(".devflow-temp-"),
			);
		});

		it("should show success message after cloning", async () => {
			await initializeProject({});

			expect(output.success).toHaveBeenCalledWith("Cloned template repository");
		});
	});

	describe("conflict checking", () => {
		it("should check for existing DevFlow folders", async () => {
			// Make .devflow exist
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes(".devflow")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockAccess).toHaveBeenCalledWith(
				expect.stringContaining(".devflow"),
			);
		});

		it("should prompt user if conflicts exist", async () => {
			// Make .devflow exist
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes(".devflow")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockQuestion).toHaveBeenCalledWith(
				"Do you want to continue and replace existing DevFlow files? (y/n) ",
			);
		});

		it("should exit if user declines to continue", async () => {
			const originalExit = process.exit;
			const mockExit = vi.fn();
			process.exit = mockExit as never;

			// Make .devflow exist
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes(".devflow")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			mockQuestion.mockResolvedValueOnce("n");

			await initializeProject({});

			expect(mockExit).toHaveBeenCalledWith(0);
			expect(output.error).toHaveBeenCalledWith("Initialization cancelled.");

			process.exit = originalExit;
		});
	});

	describe("copying DevFlow files", () => {
		it("should copy .claude/commands/agents folder", async () => {
			// Mock readdir to return empty array (no entries in agents folder)
			mockReaddir.mockResolvedValue([]);

			// Make agents source accessible
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (
					pathStr.includes(".claude/commands/agents") &&
					!pathStr.includes(".devflow-temp-")
				) {
					// Target doesn't exist yet
					return Promise.reject(new Error("ENOENT"));
				}
				if (pathStr.includes(".claude/commands/agents")) {
					// Source exists
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockMkdir).toHaveBeenCalledWith(
				expect.stringContaining(".claude/commands"),
				{ recursive: true },
			);
			expect(output.success).toHaveBeenCalledWith(
				"Agents installed (.claude/commands/agents/)",
			);
		});

		it("should create .devflow structure", async () => {
			// Make .devflow source accessible
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes(".devflow") && !pathStr.includes("project.yaml")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockMkdir).toHaveBeenCalledWith(
				expect.stringContaining(".devflow/agents"),
				{ recursive: true },
			);
			expect(mockMkdir).toHaveBeenCalledWith(
				expect.stringContaining(".devflow/memory"),
				{ recursive: true },
			);
			expect(mockMkdir).toHaveBeenCalledWith(
				expect.stringContaining(".devflow/sessions"),
				{ recursive: true },
			);
			expect(output.success).toHaveBeenCalledWith(
				"DevFlow structure created (.devflow/)",
			);
		});

		it("should copy project.yaml if it exists", async () => {
			// Make .devflow and project.yaml accessible
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes(".devflow/project.yaml")) {
					return Promise.resolve(undefined);
				}
				if (pathStr.includes(".devflow") && !pathStr.includes("project.yaml")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockCp).toHaveBeenCalledWith(
				expect.stringContaining(".devflow/project.yaml"),
				expect.stringContaining(".devflow/project.yaml"),
			);
		});

		it("should create empty project.yaml if it doesn't exist", async () => {
			// Make .devflow accessible but not project.yaml
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes(".devflow") && !pathStr.includes("project.yaml")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockWriteFile).toHaveBeenCalledWith(
				expect.stringContaining(".devflow/project.yaml"),
				"",
				"utf-8",
			);
		});

		it("should copy docs folder if it doesn't exist in target", async () => {
			// Make docs source accessible, but not target
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("docs") && pathStr.includes(".devflow-temp-")) {
					// Source exists
					return Promise.resolve(undefined);
				}
				if (pathStr.includes("docs") && !pathStr.includes(".devflow-temp-")) {
					// Target doesn't exist
					return Promise.reject(new Error("ENOENT"));
				}
				return Promise.reject(new Error("ENOENT"));
			});

			// Mock readdir for copying docs directory
			mockReaddir.mockResolvedValue([]);

			await initializeProject({});

			expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining("docs"), {
				recursive: true,
			});
			expect(output.success).toHaveBeenCalledWith(
				"Documentation structure created (docs/)",
			);
		});

		it("should keep existing docs folder if it exists", async () => {
			// Make docs target accessible
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("docs") && !pathStr.includes(".devflow-temp-")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(output.warn).toHaveBeenCalledWith(
				"docs/ folder already exists - keeping existing",
			);
		});

		it("should create docs/snapshots folder", async () => {
			await initializeProject({});

			expect(mockMkdir).toHaveBeenCalledWith(
				expect.stringContaining("docs/snapshots"),
				{ recursive: true },
			);
		});
	});

	describe(".gitignore handling", () => {
		it("should copy .gitignore if it doesn't exist in target", async () => {
			// Make .gitignore source accessible, but not target
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (
					pathStr.includes(".gitignore") &&
					pathStr.includes(".devflow-temp-")
				) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			await initializeProject({});

			expect(mockCp).toHaveBeenCalledWith(
				expect.stringContaining(".gitignore"),
				expect.stringContaining(".gitignore"),
			);
			expect(output.success).toHaveBeenCalledWith(".gitignore created");
		});

		it("should merge .gitignore if it exists in target", async () => {
			// Make both .gitignore source and target accessible
			mockAccess.mockImplementation(() => Promise.resolve(undefined));

			mockReadFile
				.mockResolvedValueOnce("existing content")
				.mockResolvedValueOnce("devflow content");

			await initializeProject({});

			expect(mockReadFile).toHaveBeenCalledTimes(2);
			expect(mockWriteFile).toHaveBeenCalledWith(
				expect.stringContaining(".gitignore"),
				"existing content\ndevflow content",
				"utf-8",
			);
			expect(output.success).toHaveBeenCalledWith(
				".gitignore updated (merged with DevFlow entries)",
			);
		});
	});

	describe("temp folder cleanup", () => {
		it("should clean up temp folder at the end", async () => {
			await initializeProject({});

			expect(mockRm).toHaveBeenCalledWith(
				expect.stringContaining(".devflow-temp-"),
				{ recursive: true, force: true },
			);
			expect(output.success).toHaveBeenCalledWith("Temporary files cleaned up");
		});

		it("should clean up temp folder even if errors occur", async () => {
			mockExecAsync.mockRejectedValueOnce(new Error("Clone failed"));

			try {
				await initializeProject({});
			} catch {
				// Expected to fail
			}

			expect(mockRm).toHaveBeenCalledWith(
				expect.stringContaining(".devflow-temp-"),
				{ recursive: true, force: true },
			);
		});
	});

	describe("success messages", () => {
		it("should show success message after initialization", async () => {
			await initializeProject({});

			expect(output.success).toHaveBeenCalledWith(
				expect.stringContaining("DevFlow initialized"),
			);
		});

		it("should include folder name in success message when folder is provided", async () => {
			await initializeProject({
				folder: "test-folder",
			});

			expect(output.success).toHaveBeenCalledWith(
				expect.stringContaining("test-folder"),
			);
		});
	});
});

describe("handleInitError", () => {
	const originalExit = process.exit;
	const mockExit = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		process.exit = mockExit as never;
	});

	afterEach(() => {
		process.exit = originalExit;
		vi.restoreAllMocks();
	});

	it("should handle git not found error", () => {
		const error = {
			code: "ENOENT",
			message: "git command not found",
		};

		handleInitError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Git is not installed or not found in PATH.",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should handle generic errors", () => {
		const error = new Error("Something went wrong");

		handleInitError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Error initializing project: Something went wrong",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should handle errors without message property", () => {
		const error = "String error";

		handleInitError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Error initializing project: String error",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});
});
