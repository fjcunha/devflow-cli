// Helper functions for terminal output without console.log
export const output = {
	info: (message: string) => {
		process.stdout.write(`ℹ ${message}\n`);
	},
	success: (message: string) => {
		process.stdout.write(`✓ ${message}\n`);
	},
	error: (message: string) => {
		process.stderr.write(`✗ ${message}\n`);
	},
	warn: (message: string) => {
		process.stdout.write(`⚠ ${message}\n`);
	},
	// For spinner-like behavior (updates same line)
	spinner: (
		message: string,
		frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
	) => {
		let frameIndex = 0;
		const interval = setInterval(() => {
			process.stdout.write(`\r${frames[frameIndex]} ${message}`);
			frameIndex = (frameIndex + 1) % frames.length;
		}, 100);
		return () => {
			clearInterval(interval);
			process.stdout.write("\r");
		};
	},
};
