# DevFlow CLI

A command-line tool for initializing new DevFlow projects from a template repository. DevFlow CLI simplifies project setup by cloning a template repository and configuring it with your project details.

## Features

- 🚀 Quick project initialization from template
- 📝 Interactive prompts for project configuration
- 🔧 Automatic package.json updates
- 🧹 Removes git history from cloned template (clean slate)
- ✅ Type-safe with TypeScript
- 🧪 Fully tested with Vitest

## Installation

### JFrog Artifactory Setup

Before installing the package, you need to configure npm to authenticate with FSAI JFrog Artifactory.

#### 1. Create or update `.npmrc` file

Create a `.npmrc` file in your home directory (`~/.npmrc`) or in your project root with the following configuration:

```ini
@Future-Secure-AI:registry=https://fsai.jfrog.io/artifactory/api/npm/npm/
//fsai.jfrog.io/artifactory/api/npm/npm/:_authToken=${ARTIFACTORY_TOKEN}
```

#### 2. Set up authentication token

You'll need to set the `ARTIFACTORY_TOKEN` environment variable with your JFrog Artifactory authentication token:

**On macOS/Linux:**
```bash
export ARTIFACTORY_TOKEN=your-artifactory-token-here
```

**On Windows (PowerShell):**
```powershell
$env:ARTIFACTORY_TOKEN="your-artifactory-token-here"
```

**On Windows (Command Prompt):**
```cmd
set ARTIFACTORY_TOKEN=your-artifactory-token-here
```

To make the token persistent, add the export command to your shell profile (e.g., `~/.zshrc`, `~/.bashrc`, or `~/.profile`).

#### 3. Alternative: Direct token in `.npmrc`

Alternatively, you can directly add your token to the `.npmrc` file (less secure):

```ini
@Future-Secure-AI:registry=https://fsai.jfrog.io/artifactory/api/npm/npm/
//fsai.jfrog.io/artifactory/api/npm/npm/:_authToken=YOUR_TOKEN_HERE
```

> **Note:** Replace `YOUR_TOKEN_HERE` with your actual JFrog Artifactory authentication token. Contact your administrator if you don't have a token.

### Global Installation

Once JFrog Artifactory is configured, install the package globally:

```bash
npm install -g @Future-Secure-AI/devflow
```

### Local Installation (for development)

```bash
git clone <repository-url>
cd devflow-cli
npm install
npm run build
```

## Usage

### Initialize a New Project

Initialize a new DevFlow project in the current directory:

```bash
devflow init
```

Initialize a new DevFlow project in a specific folder:

```bash
devflow init my-project
```

### Interactive Prompts

When you run `devflow init`, you'll be prompted for:

1. **Project name** (required): The name of your project
2. **Description** (optional): A brief description of your project

The CLI will then:
- Clone the template repository from `https://github.com/evolve-labs-cloud/devflow.git`
- Remove the git history to give you a clean slate
- Update `package.json` with your project name, description, and set version to `0.0.1`

## Development

### Prerequisites

- Node.js >= 18
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd devflow-cli
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

### Available Scripts

- `npm run build` - Build the CLI for production
- `npm run dev` - Run the CLI in development mode
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run check` - Run all checks (type checking, linting, tests, audit)
- `npm run fix` - Auto-fix linting issues

### Project Structure

```
devflow-cli/
├── src/
│   ├── cli.ts          # Main CLI entry point
│   ├── init.ts         # Project initialization logic
│   ├── output.ts       # Terminal output utilities
│   ├── utils.ts        # Helper functions
│   ├── init.test.ts    # Tests for init functionality
│   └── output.test.ts  # Tests for output utilities
├── dist/               # Compiled output (generated)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Code Organization

- **`cli.ts`**: Main entry point using Commander.js for command parsing
- **`init.ts`**: Core initialization logic including git clone, file operations, and package.json updates
- **`output.ts`**: Terminal output utilities (info, success, error, warn, spinner)
- **`utils.ts`**: Utility functions like interactive prompts

### Testing

The project uses [Vitest](https://vitest.dev/) for testing. Tests are located alongside source files with `.test.ts` extension.

Run tests:
```bash
npm test          # Watch mode
npm run test:run   # Single run
```

Test coverage includes:
- Output utility functions
- Project initialization logic
- Error handling
- File operations

### Code Quality

The project uses:
- **TypeScript** for type safety
- **Biome** for linting and formatting
- **Vitest** for testing

Run quality checks:
```bash
npm run check  # Runs type checking, linting, tests, and audit
npm run fix    # Auto-fix linting issues
```

## Architecture

### Command Flow

1. User runs `devflow init [folder]`
2. CLI prompts for project name and description
3. `initializeProject()` function:
   - Validates project name
   - Checks if target folder exists (if specified)
   - Clones template repository
   - Removes `.git` directory
   - Updates `package.json` with project details
   - Sets version to `0.0.1`

### Error Handling

The CLI handles various error scenarios:
- Missing or invalid project name
- Directory already exists
- Git not installed
- Network errors during clone
- File system errors

All errors are displayed with clear messages to help users resolve issues.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and checks (`npm run check`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style (enforced by Biome)
- Write tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting PR

## Troubleshooting

### Git Not Found

If you see "Git is not installed or not found in PATH", ensure Git is installed and available in your system PATH.

### Directory Already Exists

If the target directory already exists, the CLI will prevent overwriting. Choose a different folder name or remove the existing directory.

### Network Issues

If cloning fails due to network issues, check your internet connection and ensure the template repository is accessible.

## License

[Add your license here]

## Support

For issues, questions, or contributions, please open an issue on the repository.
