# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Run nvm use first to ensure correct Node version and pnpm availability
nvm use

# Build the project
pnpm run build

# Run tests (builds first, then runs vitest)
pnpm run test

# Run a single test file
pnpm run build && pnpm vitest run src/noticer.spec.ts

# Lint and auto-fix
pnpm run lint

# Watch mode for development
pnpm run watch

# Run noticer locally during development
pnpm run noticer <command>
```

## Project Tools

- **jj** for version control (also supports git)
- **nvm** for managing Node version
- **pnpm** for package management
- **vitest** for tests
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
