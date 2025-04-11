# Noticer

`noticer` is a tool for managing small messages that you want developers of a repo to see.

Notices are stored in the repository, and developers only see unseen notices.

It's useful for telling developers things like:

- "We changed the Dockerfiles, you'll need to rebuild them."
- "We added a new library, check it out at `packages/cool-new-thing`."
- "The platform team released a new admin tool, you can see it at http://platform.ecorp.com/admin"

It's designed to be really easy to use and setup in your repository.

## Installation

```bash
npm install @zdavison/noticer
# or
pnpm add @zdavison/noticer
# or
yarn add @zdavison/noticer
```

## Quick Start

We'll assume you're using `pnpm`, but this works with any package manager.

```
pnpm noticer init
pnpm noticer create
```

## Showing notices

By default, `noticer` installs itself into your `postinstall` script.
However, if you'd like to show notices some other way (e.g. a git hook), just call `pnpm noticer show` wherever you'd like to trigger it.

## Features

- One command setup (`noticer init`).
- Developers only see notices once.
- Fresh clones will only see the latest notice (not the entire history).
- Interactive notice creation with live preview.