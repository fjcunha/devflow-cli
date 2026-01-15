import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SpyInstance } from "vitest";
import { output } from "./output.js";

describe("output", () => {
	let stdoutWriteSpy: SpyInstance<
		[
			chunk: string | Uint8Array,
			encoding?: BufferEncoding,
			cb?: (error?: Error | null) => void,
		],
		boolean
	>;
	let stderrWriteSpy: SpyInstance<
		[
			chunk: string | Uint8Array,
			encoding?: BufferEncoding,
			cb?: (error?: Error | null) => void,
		],
		boolean
	>;

	beforeEach(() => {
		stdoutWriteSpy = vi.spyOn(process.stdout, "write");
		stderrWriteSpy = vi.spyOn(process.stderr, "write");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("info", () => {
		it("should write info message to stdout", () => {
			output.info("Test message");
			expect(stdoutWriteSpy).toHaveBeenCalledWith("ℹ Test message\n");
		});
	});

	describe("success", () => {
		it("should write success message to stdout", () => {
			output.success("Test message");
			expect(stdoutWriteSpy).toHaveBeenCalledWith("✓ Test message\n");
		});
	});

	describe("error", () => {
		it("should write error message to stderr", () => {
			output.error("Test message");
			expect(stderrWriteSpy).toHaveBeenCalledWith("✗ Test message\n");
		});
	});

	describe("warn", () => {
		it("should write warning message to stdout", () => {
			output.warn("Test message");
			expect(stdoutWriteSpy).toHaveBeenCalledWith("⚠ Test message\n");
		});
	});

	describe("spinner", () => {
		it("should return a function to stop the spinner", () => {
			vi.useFakeTimers();
			const stopSpinner = output.spinner("Loading...");

			// Advance time to trigger interval
			vi.advanceTimersByTime(100);

			expect(stdoutWriteSpy).toHaveBeenCalled();
			expect(typeof stopSpinner).toBe("function");

			stopSpinner();
			vi.advanceTimersByTime(100);

			// After stopping, should clear the line
			expect(stdoutWriteSpy).toHaveBeenCalledWith("\r");

			vi.useRealTimers();
		});

		it("should use custom frames if provided", () => {
			vi.useFakeTimers();
			const customFrames = ["A", "B", "C"];
			const stopSpinner = output.spinner("Loading...", customFrames);

			vi.advanceTimersByTime(100);
			expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining("A"));

			vi.advanceTimersByTime(100);
			expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining("B"));

			stopSpinner();
			vi.useRealTimers();
		});
	});
});
