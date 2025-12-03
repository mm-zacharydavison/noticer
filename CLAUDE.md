# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Build the project (Node.js-compatible output for npm)
bun run build

# Build the standalone executable (for local testing)
bun run build:bundle

# Run tests (builds first, then runs bun test)
bun run test

# Run a single test file
bun run build && bun test src/noticer.spec.ts

# Lint and auto-fix
bun run lint

# Watch mode for development
bun run watch

# Run noticer locally during development
bun run noticer <command>
```

## Distribution

### npm (for Node.js projects)
```bash
bun run publish-pkg
```
Publishes the unbundled Node.js version to npm.

### GitHub Releases (standalone executables)
Push a version tag to trigger the release workflow:
```bash
git tag v1.2.0
git push origin v1.2.0
```
This builds executables for linux-x64, darwin-x64, darwin-arm64, and windows-x64.

### One-liner install (standalone)
```bash
curl -fsSL https://raw.githubusercontent.com/zdavison/noticer/main/install.sh | sh
```

## Build Outputs

1. **npm package** (`dist/bin/noticer.js`, `dist/lib.js`, etc.) - Non-bundled ES modules for Node.js projects
2. **Standalone executables** (GitHub Releases) - Platform-specific binaries for non-Node.js environments

## Project Tools

- **jj** for version control (also supports git)
- **bun** for package management, building, and testing
- **biome** for linting

## Architecture

Noticer is a CLI tool for displaying developer notices in a repository. Notices are stored as JSON files and tracked per-user.

### Key Files

- `src/lib.ts` - Core library with all notice management logic (reading, writing, displaying notices)
- `src/bin/noticer.ts` - CLI entry point using Commander.js

### Data Flow

1. Notices are stored in `.noticer/notices/` as JSON files with format `{timestamp}.json`
2. User's seen notices are tracked in `.noticer/seen.json` (gitignored)
3. On first run (`show`), all notices except the latest are auto-marked as seen
4. Commands prefixed with `!>` in notice content trigger interactive execution prompts

### CLI Commands

- `noticer init` - Sets up postinstall hook and .gitignore entry
- `noticer create [content]` - Creates a notice (interactive mode if no content provided)
- `noticer show [-n N]` - Displays unseen notices (or last N notices)
