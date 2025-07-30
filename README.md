<img width="862" alt="image" src="https://github.com/user-attachments/assets/36dfb39c-10fd-411d-97fd-c0f468cd168c" />

# 📝 Noticer

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
- **Command execution**: Include commands in notices that users can execute interactively.

## Command Execution

You can include commands in your notices that users will be prompted to execute when they view the notice. This is useful for automating setup tasks or running necessary commands.

To include a command in a notice, prefix it with `!>`:

```
pnpm noticer create "We updated the database schema!

Please run the migration:
!> npm run migrate

And then restart your dev server:
!> npm run dev"
```

When users run `noticer show`, they'll see the notice and be prompted to execute each command:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📝 Team Lead                       ┃
┃     July 30, 2025                   ┃
┃                                     ┃
┃ We updated the database schema!     ┃
┃                                     ┃
┃ Please run the migration:           ┃
┃ !> npm run migrate                  ┃
┃                                     ┃
┃ And then restart your dev server:   ┃
┃ !> npm run dev                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

? Execute command: npm run migrate? (y/N)
```

Users can choose to execute or skip each command. Commands are executed in the repository's root directory.

# Contributors

`noticer` was developed at [MeetsMore](http://meetsmore.com/) and then open sourced.
