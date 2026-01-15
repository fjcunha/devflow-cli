import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PathLike } from "node:fs";
import { readFile, rm, access, mkdir, cp, readdir } from "node:fs/promises";
import { startIde, updateIde, handleIdeError } from "./ide.js";
import { output } from "./output.js";

// Create shared mocks using vi.hoisted
const { mockExecAsync, mockSpawn, mockFetch } = vi.hoisted(() => {
	const execAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
	const spawn = vi.fn();
	const fetch = vi.fn();
	return { mockExecAsync: execAsync, mockSpawn: spawn, mockFetch: fetch };
});

// Mock modules
vi.mock("node:fs/promises");
vi.mock("node:child_process", () => ({
	exec: vi.fn(),
	spawn: mockSpawn,
}));
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

// Mock global fetch
vi.stubGlobal("fetch", mockFetch);

describe("startIde", () => {
	const mockReadFile = vi.mocked(readFile);
	const mockRm = vi.mocked(rm);
	const mockAccess = vi.mocked(access);
	const mockMkdir = vi.mocked(mkdir);
	const mockCp = vi.mocked(cp);
	const mockReaddir = vi.mocked(readdir);

	beforeEach(() => {
		vi.clearAllMocks();
		mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
		mockMkdir.mockResolvedValue(undefined);
		mockCp.mockResolvedValue(undefined);
		mockRm.mockResolvedValue(undefined);
		mockReaddir.mockResolvedValue([]);
		mockAccess.mockRejectedValue(new Error("ENOENT"));

		// Mock spawn to simulate successful command execution
		mockSpawn.mockImplementation(() => {
			const mockProcess: any = {
				on: vi.fn((event: string, callback: (code: number) => void) => {
					if (event === "close") {
						// Simulate successful exit
						setTimeout(() => callback(0), 0);
					}
					return mockProcess;
				}),
			};
			return mockProcess;
		});

		// Mock fetch for remote version check
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ version: "1.0.0" }),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("web folder setup", () => {
		it("should clone and setup web folder if it does not exist", async () => {
			// web folder doesn't exist
			mockAccess.mockRejectedValue(new Error("ENOENT"));

			await startIde();

			expect(mockExecAsync).toHaveBeenCalledWith(
				expect.stringContaining("git clone"),
			);
			expect(output.success).toHaveBeenCalledWith("Repository cloned");
		});

		it("should not clone if web folder already exists", async () => {
			// web folder exists
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("web")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			// Mock local package.json
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));

			await startIde();

			// Should not call git clone since web folder exists
			expect(mockExecAsync).not.toHaveBeenCalledWith(
				expect.stringContaining("git clone"),
			);
		});
	});

	describe("version checking", () => {
		it("should show update warning when newer version is available", async () => {
			// web folder exists
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("web")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			// Local version is older
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));

			// Remote version is newer
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ version: "2.0.0" }),
			});

			await startIde();

			expect(output.warn).toHaveBeenCalledWith(
				"New version available: 2.0.0 (current: 1.0.0)",
			);
			expect(output.info).toHaveBeenCalledWith(
				"Run 'devflow ide update' to update to the latest version\n",
			);
		});

		it("should not show update warning when version is current", async () => {
			// web folder exists
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("web")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			// Same version
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ version: "1.0.0" }),
			});

			await startIde();

			expect(output.warn).not.toHaveBeenCalledWith(
				expect.stringContaining("New version available"),
			);
		});

		it("should handle fetch errors gracefully", async () => {
			// web folder exists
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("web")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
			mockFetch.mockRejectedValue(new Error("Network error"));

			// Should not throw
			await expect(startIde()).resolves.not.toThrow();
		});
	});

	describe("npm install", () => {
		it("should run npm install if node_modules does not exist", async () => {
			// web exists, node_modules doesn't
			mockAccess.mockImplementation((path: PathLike) => {
				const pathStr = String(path);
				if (pathStr.includes("web") && !pathStr.includes("node_modules")) {
					return Promise.resolve(undefined);
				}
				return Promise.reject(new Error("ENOENT"));
			});

			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));

			await startIde();

			expect(output.info).toHaveBeenCalledWith("Installing dependencies...");
			expect(mockSpawn).toHaveBeenCalledWith("npm", ["install"], {
				cwd: expect.stringContaining("web"),
				stdio: "inherit",
				shell: true,
			});
		});

		it("should skip npm install if node_modules exists", async () => {
			// Both web and node_modules exist
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));

			await startIde();

			expect(output.info).not.toHaveBeenCalledWith(
				"Installing dependencies...",
			);
		});
	});

	describe("dev server", () => {
		it("should start the Next.js dev server", async () => {
			mockAccess.mockResolvedValue(undefined);
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));

			await startIde();

			expect(output.info).toHaveBeenCalledWith("Starting DevFlow IDE...");
			expect(mockSpawn).toHaveBeenCalledWith("npm", ["run", "dev"], {
				cwd: expect.stringContaining("web"),
				stdio: "inherit",
				shell: true,
			});
		});
	});

	describe("temp folder cleanup", () => {
		it("should clean up temp folder after setup", async () => {
			mockAccess.mockRejectedValue(new Error("ENOENT"));

			await startIde();

			expect(mockRm).toHaveBeenCalledWith(
				expect.stringContaining(".devflow-ide-temp-"),
				{ recursive: true, force: true },
			);
			expect(output.success).toHaveBeenCalledWith("Temporary files cleaned up");
		});
	});
});

describe("updateIde", () => {
	const mockReadFile = vi.mocked(readFile);
	const mockRm = vi.mocked(rm);
	const mockAccess = vi.mocked(access);
	const mockMkdir = vi.mocked(mkdir);
	const mockCp = vi.mocked(cp);
	const mockReaddir = vi.mocked(readdir);

	beforeEach(() => {
		vi.clearAllMocks();
		mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
		mockMkdir.mockResolvedValue(undefined);
		mockCp.mockResolvedValue(undefined);
		mockRm.mockResolvedValue(undefined);
		mockReaddir.mockResolvedValue([]);
		mockAccess.mockRejectedValue(new Error("ENOENT"));
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("version checking", () => {
		it("should skip update if already up to date", async () => {
			// web folder exists
			mockAccess.mockResolvedValue(undefined);

			// Same version
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ version: "1.0.0" }),
			});

			await updateIde();

			expect(output.success).toHaveBeenCalledWith(
				"DevFlow IDE is already up to date (version 1.0.0)",
			);
			expect(mockExecAsync).not.toHaveBeenCalled();
		});

		it("should skip update if local version is newer than remote", async () => {
			mockAccess.mockResolvedValue(undefined);

			// Local is newer
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "2.0.0" }));
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ version: "1.0.0" }),
			});

			await updateIde();

			expect(output.success).toHaveBeenCalledWith(
				"DevFlow IDE is already up to date (version 2.0.0)",
			);
			expect(mockExecAsync).not.toHaveBeenCalled();
		});

		it("should proceed with update when newer version available", async () => {
			mockAccess.mockResolvedValue(undefined);

			// Remote is newer
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ version: "2.0.0" }),
			});

			await updateIde();

			expect(output.info).toHaveBeenCalledWith(
				"Updating DevFlow IDE from 1.0.0 to 2.0.0...",
			);
			expect(mockExecAsync).toHaveBeenCalledWith(
				expect.stringContaining("git clone"),
			);
		});

		it("should show generic up to date message when versions cannot be determined", async () => {
			mockAccess.mockResolvedValue(undefined);

			// Cannot read local version
			mockReadFile.mockRejectedValue(new Error("File not found"));
			mockFetch.mockRejectedValue(new Error("Network error"));

			await updateIde();

			expect(output.success).toHaveBeenCalledWith(
				"DevFlow IDE is already up to date",
			);
		});
	});

	describe("fresh install", () => {
		it("should install if web folder does not exist", async () => {
			mockAccess.mockRejectedValue(new Error("ENOENT"));

			await updateIde();

			expect(output.info).toHaveBeenCalledWith("Installing DevFlow IDE...");
			expect(mockExecAsync).toHaveBeenCalledWith(
				expect.stringContaining("git clone"),
			);
		});
	});

	describe("replace existing", () => {
		it("should remove existing web folder when updating", async () => {
			mockAccess.mockResolvedValue(undefined);

			// Remote is newer
			mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ version: "2.0.0" }),
			});

			await updateIde();

			expect(output.success).toHaveBeenCalledWith(
				"Existing web folder removed",
			);
			expect(mockRm).toHaveBeenCalledWith(expect.stringContaining("web"), {
				recursive: true,
				force: true,
			});
		});
	});

	describe("success message", () => {
		it("should show success message after update", async () => {
			mockAccess.mockRejectedValue(new Error("ENOENT"));

			await updateIde();

			expect(output.success).toHaveBeenCalledWith(
				"DevFlow IDE updated successfully",
			);
		});
	});
});

describe("handleIdeError", () => {
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

		handleIdeError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Git is not installed or not found in PATH.",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should handle generic errors with message", () => {
		const error = new Error("Something went wrong");

		handleIdeError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Error starting IDE: Something went wrong",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should handle errors without message property", () => {
		const error = "String error";

		handleIdeError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Error starting IDE: String error",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});

	it("should handle ENOENT errors not related to git", () => {
		const error = {
			code: "ENOENT",
			message: "file not found",
		};

		handleIdeError(error);

		expect(output.error).toHaveBeenCalledWith(
			"Error starting IDE: file not found",
		);
		expect(mockExit).toHaveBeenCalledWith(1);
	});
});

describe("version comparison", () => {
	const mockReadFile = vi.mocked(readFile);
	const mockAccess = vi.mocked(access);
	const mockRm = vi.mocked(rm);
	const mockMkdir = vi.mocked(mkdir);
	const mockReaddir = vi.mocked(readdir);

	beforeEach(() => {
		vi.clearAllMocks();
		mockExecAsync.mockResolvedValue({ stdout: "", stderr: "" });
		mockMkdir.mockResolvedValue(undefined);
		mockRm.mockResolvedValue(undefined);
		mockReaddir.mockResolvedValue([]);
		mockAccess.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should detect update for major version bump", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ version: "2.0.0" }),
		});

		await updateIde();

		expect(output.info).toHaveBeenCalledWith(
			"Updating DevFlow IDE from 1.0.0 to 2.0.0...",
		);
	});

	it("should detect update for minor version bump", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ version: "1.1.0" }),
		});

		await updateIde();

		expect(output.info).toHaveBeenCalledWith(
			"Updating DevFlow IDE from 1.0.0 to 1.1.0...",
		);
	});

	it("should detect update for patch version bump", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0.0" }));
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ version: "1.0.1" }),
		});

		await updateIde();

		expect(output.info).toHaveBeenCalledWith(
			"Updating DevFlow IDE from 1.0.0 to 1.0.1...",
		);
	});

	it("should not update when versions are equal", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.2.3" }));
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ version: "1.2.3" }),
		});

		await updateIde();

		expect(output.success).toHaveBeenCalledWith(
			"DevFlow IDE is already up to date (version 1.2.3)",
		);
	});

	it("should handle versions with different segment lengths", async () => {
		mockReadFile.mockResolvedValue(JSON.stringify({ version: "1.0" }));
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ version: "1.0.1" }),
		});

		await updateIde();

		expect(output.info).toHaveBeenCalledWith(
			"Updating DevFlow IDE from 1.0 to 1.0.1...",
		);
	});
});
