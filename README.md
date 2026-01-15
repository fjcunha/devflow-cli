<div align="center">

# DevFlow CLI

**A powerful command-line tool for initializing DevFlow projects with Claude AI agents**

[![CI](https://github.com/fjcunha/devflow-cli/actions/workflows/check.yaml/badge.svg)](https://github.com/fjcunha/devflow-cli/actions/workflows/check.yaml)
[![codecov](https://codecov.io/gh/fjcunha/devflow-cli/branch/main/graph/badge.svg)](https://codecov.io/gh/fjcunha/devflow-cli)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#features) | [Installation](#installation) | [Usage](#usage) | [Development](#development) | [Contributing](#contributing)

</div>

---

## Overview

DevFlow CLI simplifies the setup of DevFlow-powered projects by installing Claude AI agents, project structure templates, and configuration files into your existing projects. It handles dependency validation, provides OS-specific installation guidance, and ensures a smooth onboarding experience.

## Features

| Feature | Description |
|---------|-------------|
| **Project Initialization** | Install DevFlow components into existing projects with a single command |
| **Dependency Validation** | Automatically checks for Git, Claude Code, Node.js, Python, GCC, and Make |
| **Cross-Platform Support** | Works on macOS, Windows, Ubuntu, Debian, Fedora, RHEL, CentOS, and Arch Linux |
| **Claude AI Agents** | Installs pre-configured Claude agents for enhanced development workflows |
| **Conflict Resolution** | Gracefully handles existing files with user prompts |
| **Smart .gitignore Merge** | Intelligently merges DevFlow entries with your existing .gitignore |

## Requirements

| Dependency | Required | Description |
|------------|----------|-------------|
| **Git** | Yes | Version control |
| **Claude Code** | Yes | AI-powered coding assistant |
| **Node.js** | Optional | v18+ for Web IDE features |
| **Python 3** | Optional | For Web IDE features |
| **GCC** | Optional | For native module compilation |
| **Make** | Optional | For build automation |

## Installation

### Quick Install

```bash
npm install -g devflow-cli
```

### From Source

```bash
git clone https://github.com/fjcunha/devflow-cli.git
cd devflow-cli
npm install
npm run build
npm link
```

## Usage

### Initialize DevFlow in Current Directory

```bash
devflow init
```

### Initialize in a Specific Folder

```bash
devflow init my-project
```

### Skip Dependency Checks

```bash
devflow init --skip-deps
```

### Get Help

```bash
devflow --help
devflow init --help
```

### What Gets Installed

When you run `devflow init`, the following components are added to your project:

```
your-project/
├── .claude/
│   └── commands/
│       └── agents/          # Claude AI agent configurations
├── .devflow/
│   ├── agents/              # Agent definitions
│   ├── memory/              # Persistent memory storage
│   └── sessions/            # Session management
├── docs/                    # Documentation templates
└── .gitignore               # Updated with DevFlow entries
```

## Development

### Prerequisites

- Node.js >= 18
- npm >= 9

### Setup

```bash
# Clone the repository
git clone https://github.com/fjcunha/devflow-cli.git
cd devflow-cli

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build for production |
| `npm run dev` | Run in development mode |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run check` | Run all quality checks (types, lint, tests, audit) |
| `npm run fix` | Auto-fix linting issues |

### Project Structure

```
devflow-cli/
├── src/
│   ├── cli.ts              # Main CLI entry point (Commander.js)
│   ├── init.ts             # Project initialization logic
│   ├── deps.ts             # Dependency checking & OS detection
│   ├── output.ts           # Terminal output utilities
│   ├── utils.ts            # Helper functions
│   ├── postinstall.ts      # Post-install script
│   └── *.test.ts           # Test files
├── dist/                   # Compiled output
├── .github/
│   └── workflows/          # CI/CD pipelines
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── biome.jsonc
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Entry                            │
│                        (cli.ts)                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌───────────────┐
│   Dependency    │ │   Init    │ │    Output     │
│    Checker      │ │  Logic    │ │   Utilities   │
│   (deps.ts)     │ │ (init.ts) │ │ (output.ts)   │
└─────────────────┘ └───────────┘ └───────────────┘
         │                │
         ▼                ▼
┌─────────────────┐ ┌───────────────────────────────┐
│  OS Detection   │ │     File Operations           │
│  & Install      │ │  - Clone template repo        │
│  Instructions   │ │  - Copy DevFlow components    │
└─────────────────┘ │  - Merge .gitignore           │
                    └───────────────────────────────┘
```

## Testing

The project uses [Vitest](https://vitest.dev/) for testing with comprehensive coverage.

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npx vitest --ui
```

### Test Coverage

| Module | Coverage Focus |
|--------|----------------|
| `deps.ts` | OS detection, dependency checking, installation instructions |
| `init.ts` | Project initialization, file operations, conflict handling |
| `output.ts` | Terminal output, spinner functionality |

## Code Quality

| Tool | Purpose |
|------|---------|
| **TypeScript** | Static type checking (strict mode) |
| **Biome** | Linting and formatting |
| **Vitest** | Unit testing |
| **npm audit** | Security vulnerability scanning |

Run all checks:

```bash
npm run check
```

## CI/CD

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `check.yaml` | Pull Requests | Run type checks, linting, tests, and audit |
| `release.yaml` | Version tags (v*.*.*) | Build and publish to npm registries |
| `tag.yaml` | Manual | Create version tags |

## Troubleshooting

### Common Issues

<details>
<summary><strong>Git Not Found</strong></summary>

Ensure Git is installed and available in your system PATH:

```bash
# Check if Git is installed
git --version

# Install on Ubuntu/Debian
sudo apt install git

# Install on macOS
brew install git
```

</details>

<details>
<summary><strong>Claude Code Not Found</strong></summary>

Install Claude Code CLI:

```bash
# Install via npm
npm install -g @anthropic-ai/claude-code
```

</details>

<details>
<summary><strong>Permission Denied</strong></summary>

If you encounter permission issues during global installation:

```bash
# Use sudo (Linux/macOS)
sudo npm install -g devflow-cli

# Or fix npm permissions
# https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally
```

</details>

<details>
<summary><strong>Network Issues</strong></summary>

If cloning the template repository fails:

1. Check your internet connection
2. Verify access to `https://github.com/evolve-labs-cloud/devflow.git`
3. Check if you're behind a proxy and configure Git accordingly

</details>

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run quality checks (`npm run check`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Guidelines

- Follow the existing code style (enforced by Biome)
- Write tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with TypeScript and Commander.js**

[Report Bug](https://github.com/fjcunha/devflow-cli/issues) | [Request Feature](https://github.com/fjcunha/devflow-cli/issues)

</div>
