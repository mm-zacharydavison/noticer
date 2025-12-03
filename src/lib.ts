import nodeFs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import chalk from 'chalk'
import fs from 'fs-extra'
import prompts from 'prompts'

const NOTICER_DIR = '.noticer'
const NOTICES_DIR = 'notices'
const SEEN_NOTICES_FILE = 'seen.json'

/**
 * Represents a notice to be displayed to users
 */
export interface Notice {
  /** Unique identifier for the notice */
  id: string
  /** Content of the notice to be displayed */
  content: string
  /** Author who created the notice */
  author: string
  /** ISO date string when the notice was created */
  date: string
}

/**
 * Map of notice IDs to boolean values indicating if they've been seen
 */
export interface SeenNotices {
  [id: string]: boolean
}

/**
 * Gets the path to the noticer directory in the repository
 * @param repoRoot - The root directory of the repository
 * @returns The path to the noticer directory
 */
export function getNoticerDir(repoRoot: string): string {
  return path.join(repoRoot, NOTICER_DIR)
}

/**
 * Gets the path to the notices directory in the repository
 * @param repoRoot - The root directory of the repository
 * @returns The path to the notices directory
 */
export function getNoticesDir(repoRoot: string): string {
  return path.join(getNoticerDir(repoRoot), NOTICES_DIR)
}

/**
 * Gets the path to the seen notices file in the repository
 * @param repoRoot - The root directory of the repository
 * @returns The path to the seen notices file
 */
export function getSeenNoticesPath(repoRoot: string): string {
  return path.join(getNoticerDir(repoRoot), SEEN_NOTICES_FILE)
}

/**
 * Finds the root directory of the repository
 * @returns The path to the repository root
 * @throws Error if not in a git or jujutsu repository
 */
export function getRepoRoot(): string {
  // Start from the current directory and traverse up until we find a .git or .jj directory
  let currentDir = process.cwd()
  while (currentDir !== '/') {
    if (fs.existsSync(path.join(currentDir, '.git')) || fs.existsSync(path.join(currentDir, '.jj'))) {
      return currentDir
    }
    currentDir = path.dirname(currentDir)
  }
  throw new Error('❌ Not in a git or jujutsu repository')
}

/**
 * Gets the map of notices that have been seen by the user
 * @param repoRoot - The root directory of the repository
 * @returns Object mapping notice IDs to boolean values
 */
export function getSeenNotices(repoRoot: string): SeenNotices {
  const seenNoticesPath = getSeenNoticesPath(repoRoot)
  if (!fs.existsSync(seenNoticesPath)) {
    return {}
  }
  return fs.readJsonSync(seenNoticesPath)
}

/**
 * Saves the map of seen notices to disk
 * @param repoRoot - The root directory of the repository
 * @param seenNotices - Object mapping notice IDs to boolean values
 */
export function saveSeenNotices(repoRoot: string, seenNotices: SeenNotices): void {
  const seenNoticesPath = getSeenNoticesPath(repoRoot)
  const noticerDir = getNoticerDir(repoRoot)

  if (!fs.existsSync(noticerDir)) {
    fs.mkdirpSync(noticerDir)
  }

  fs.writeJsonSync(seenNoticesPath, seenNotices, { spaces: 2 })
}

/**
 * Marks a notice as seen by the user
 * @param repoRoot - The root directory of the repository
 * @param noticeId - ID of the notice to mark as seen
 */
export function markNoticeAsSeen(repoRoot: string, noticeId: string): void {
  const seenNotices = getSeenNotices(repoRoot)
  seenNotices[noticeId] = true
  saveSeenNotices(repoRoot, seenNotices)
}

/**
 * Gets all notices in the repository
 * @param repoRoot - The root directory of the repository
 * @returns Array of Notice objects
 */
export function getNotices(repoRoot: string): Notice[] {
  const noticesDir = getNoticesDir(repoRoot)
  if (!fs.existsSync(noticesDir)) {
    return []
  }

  const noticeFiles = fs
    .readdirSync(noticesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(noticesDir, file))

  return noticeFiles.map((file) => {
    const notice = fs.readJsonSync(file)
    return {
      id: path.basename(file, '.json'),
      content: notice.content,
      author: notice.author,
      date: notice.date,
    }
  })
}

/**
 * Returns all notices, sorted by date, ascending.
 * @param repoRoot - The root directory of the repository
 * @returns Array of Notice objects
 */
export function getSortedNotices(repoRoot: string): Notice[] {
  return getNotices(repoRoot).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

/**
 * Gets notices that haven't been seen by the user
 * @param repoRoot - The root directory of the repository
 * @returns Array of unseen Notice objects
 */
export function getUnseenNotices(repoRoot: string): Notice[] {
  const notices = getNotices(repoRoot)
  const seenNotices = getSeenNotices(repoRoot)

  // Get all unseen notices.
  const unseenNotices = notices.filter((notice) => !seenNotices[notice.id])

  return unseenNotices
}

/**
 * Extracts commands from notice content that are prefixed with '!>'
 * @param content - The notice content to parse
 * @returns Array of commands found in the content
 */
function extractCommands(content: string): string[] {
  const lines = content.split('\n')
  const commands: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('!>')) {
      const command = trimmed.slice(2).trim()
      if (command) {
        commands.push(command)
      }
    }
  }
  
  return commands
}

/**
 * Attempts to get a TTY stream for interactive prompts.
 * In git hooks, stdin is often not a TTY, but we can reopen /dev/tty.
 * @returns A readable stream connected to the terminal, or null if unavailable
 */
function getTTYStream(): nodeFs.ReadStream | null {
  if (process.stdin.isTTY) {
    return null // stdin is already a TTY, no need to replace
  }

  try {
    // /dev/tty is a special file that refers to the controlling terminal
    const ttyFd = nodeFs.openSync('/dev/tty', 'r')
    return nodeFs.createReadStream('', { fd: ttyFd })
  } catch {
    // /dev/tty not available (Windows, or headless CI)
    return null
  }
}

/**
 * Executes a command
 * @param command - The command to execute
 * @param repoRoot - The repository root directory to execute commands from
 */
function executeCommand(command: string, repoRoot: string): void {
  console.log(chalk.blue(`Executing: ${command}`))
  try {
    execSync(command, { stdio: 'inherit', cwd: repoRoot })
  } catch (error) {
    console.error(chalk.red(`Command failed: ${error instanceof Error ? error.message : String(error)}`))
  }
}

/**
 * Prompts user to execute a command and executes it if they agree
 * @param command - The command to potentially execute
 * @param repoRoot - The repository root directory to execute commands from
 * @param autoExecute - Whether to auto-execute without prompting
 * @param inputStream - Optional input stream to use for prompts
 */
async function promptAndExecuteCommand(
  command: string,
  repoRoot: string,
  autoExecute = false,
  inputStream?: nodeFs.ReadStream | NodeJS.ReadStream
): Promise<void> {
  // Auto-execute mode: run without prompting
  if (autoExecute) {
    executeCommand(command, repoRoot)
    return
  }

  // Use provided stream, or fall back to stdin if it's a TTY
  const stdin = inputStream ?? (process.stdin.isTTY ? process.stdin : null)
  if (!stdin) {
    // No terminal available, skip command prompts
    return
  }

  try {
    const response = await prompts({
      type: 'confirm',
      name: 'execute',
      message: `Execute command: ${chalk.yellow(command)}?`,
      initial: false,
      stdin,
      stdout: process.stdout
    })

    if (response.execute) {
      executeCommand(command, repoRoot)
    }
  } catch (error) {
    // Handle prompts cancellation gracefully
  }
}

/**
 * Prints a single notice with a formatted border (synchronous version for previews)
 * @param notice - The notice to print
 */
export function printNoticeSync(notice: Notice): void {
  const contentLines = notice.content.split('\n')
  const formattedDate = new Date(notice.date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const width = Math.max(
    ...contentLines.map((line) => line.length),
    notice.author.length + 10,
    formattedDate.length + 10,
  )

  // Create border elements
  const horizontalBorder = chalk.cyan('━'.repeat(width + 4))
  const topBorder = chalk.cyan('┏') + horizontalBorder + chalk.cyan('┓')
  const bottomBorder = chalk.cyan('┗') + horizontalBorder + chalk.cyan('┛')

  // Print the notice with border
  console.log('')
  console.log(topBorder)
  console.log(chalk.cyan('┃') + ' '.repeat(width + 4) + chalk.cyan('┃'))

  // Print author line
  const authorLine = ` 📝 ${notice.author}`
  console.log(
    `${chalk.cyan('┃')} ${chalk.yellow(authorLine)}${' '.repeat(width + 3 - authorLine.length)}${chalk.cyan('┃')}`,
  )

  // Print date line
  const dateLine = `    ${formattedDate}`
  console.log(
    `${chalk.cyan('┃')} ${chalk.gray(dateLine)}${' '.repeat(width + 3 - dateLine.length)}${chalk.cyan('┃')}`,
  )

  console.log(chalk.cyan('┃') + ' '.repeat(width + 4) + chalk.cyan('┃'))

  // Print content lines
  for (const line of contentLines) {
    console.log(
      `${chalk.cyan('┃')} ${line}${' '.repeat(width + 3 - line.length)}${chalk.cyan('┃')}`,
    )
  }

  console.log(chalk.cyan('┃') + ' '.repeat(width + 4) + chalk.cyan('┃'))
  console.log(bottomBorder)
  console.log('')
}

/**
 * Prints a single notice with a formatted border
 * @param notice - The notice to print
 * @param repoRoot - The repository root directory to execute commands from
 * @param autoExecute - Whether to auto-execute commands without prompting
 * @param inputStream - Optional input stream to use for prompts
 */
export async function printNotice(
  notice: Notice,
  repoRoot?: string,
  autoExecute = false,
  inputStream?: nodeFs.ReadStream | NodeJS.ReadStream
): Promise<void> {
  const contentLines = notice.content.split('\n')
  const formattedDate = new Date(notice.date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const width = Math.max(
    ...contentLines.map((line) => line.length),
    notice.author.length + 10,
    formattedDate.length + 10,
  )

  // Create border elements
  const horizontalBorder = chalk.cyan('━'.repeat(width + 4))
  const topBorder = chalk.cyan('┏') + horizontalBorder + chalk.cyan('┓')
  const bottomBorder = chalk.cyan('┗') + horizontalBorder + chalk.cyan('┛')

  // Print the notice with border
  console.log('')
  console.log(topBorder)
  console.log(chalk.cyan('┃') + ' '.repeat(width + 4) + chalk.cyan('┃'))

  // Print author line
  const authorLine = ` 📝 ${notice.author}`
  console.log(
    `${chalk.cyan('┃')} ${chalk.yellow(authorLine)}${' '.repeat(width + 3 - authorLine.length)}${chalk.cyan('┃')}`,
  )

  // Print date line
  const dateLine = `    ${formattedDate}`
  console.log(
    `${chalk.cyan('┃')} ${chalk.gray(dateLine)}${' '.repeat(width + 3 - dateLine.length)}${chalk.cyan('┃')}`,
  )

  console.log(chalk.cyan('┃') + ' '.repeat(width + 4) + chalk.cyan('┃'))

  // Print content lines
  for (const line of contentLines) {
    console.log(
      `${chalk.cyan('┃')} ${line}${' '.repeat(width + 3 - line.length)}${chalk.cyan('┃')}`,
    )
  }

  console.log(chalk.cyan('┃') + ' '.repeat(width + 4) + chalk.cyan('┃'))
  console.log(bottomBorder)
  console.log('')

  // Check for commands in the notice content
  const commands = extractCommands(notice.content)
  const commandRepoRoot = repoRoot || getRepoRoot()
  for (const command of commands) {
    await promptAndExecuteCommand(command, commandRepoRoot, autoExecute, inputStream)
  }
}

/**
 * Prints multiple notices
 * @param notices - Array of notices to print
 * @param repoRoot - The repository root directory to execute commands from
 * @param autoExecute - Whether to auto-execute commands without prompting
 */
export async function printNotices(notices: Notice[], repoRoot?: string, autoExecute = false): Promise<void> {
  if (notices.length === 0) {
    return
  }

  // Create TTY stream once for all prompts (for git hook environments)
  const ttyStream = !autoExecute ? getTTYStream() : null
  const inputStream = ttyStream ?? (process.stdin.isTTY ? process.stdin : undefined)

  try {
    console.log('')
    for (const notice of notices) {
      await printNotice(notice, repoRoot, autoExecute, inputStream)
    }
    console.log('')
  } finally {
    if (ttyStream) {
      ttyStream.close()
    }
  }
}

/**
 * Checks if this is the first run, and if it is, marks all notices as seen except the latest.
 */
export function handleFirstRun(repoRoot: string): void {
  // If we don't have a `seen.json`, it's our first run, we have no state.
  if (!fs.existsSync(getSeenNoticesPath(repoRoot))) {
    // Mark all notices as read except the latest.
    const notices = getSortedNotices(repoRoot).slice(1)
    for (const notice of notices) {
      markNoticeAsSeen(repoRoot, notice.id)
    }
  }
}

/**
 * Options for the run function
 */
export interface RunOptions {
  /** Optional number of most recent notices to show */
  number?: number
  /** Whether to auto-execute commands without prompting */
  autoExecute?: boolean
}

/**
 * Main function to run the noticer
 * Displays unseen notices and marks them as seen
 * @param options - Run options (number, autoExecute)
 */
export async function run(options: RunOptions = {}): Promise<void> {
  const { number, autoExecute = false } = options
  try {
    const repoRoot = getRepoRoot()
    handleFirstRun(repoRoot)
    if (number) {
      const sortedNotices = getSortedNotices(repoRoot)
      const noticesToShow = sortedNotices.slice(0, number)
      await printNotices(noticesToShow, repoRoot, autoExecute)
      for (const notice of noticesToShow) {
        markNoticeAsSeen(repoRoot, notice.id)
      }
    } else {
      const unseenNotices = getUnseenNotices(repoRoot)
      await printNotices(unseenNotices, repoRoot, autoExecute)
      for (const notice of unseenNotices) {
        markNoticeAsSeen(repoRoot, notice.id)
      }
    }
  } catch (error) {
    // Silently fail if we're not in a git repository
  }
}

/**
 * Detects which package manager is being used in the repository
 * @param repoRoot - The root directory of the repository
 * @returns The detected package manager command ('bun', 'pnpm', 'yarn', or 'npm')
 */
export function detectPackageManager(repoRoot: string): string {
  // Check for lock files in order of preference
  if (fs.existsSync(path.join(repoRoot, 'bun.lockb')) || fs.existsSync(path.join(repoRoot, 'bun.lock'))) {
    return 'bun'
  }
  if (fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (fs.existsSync(path.join(repoRoot, 'yarn.lock'))) {
    return 'yarn'
  }
  // Default to npm if no other lock file is found
  return 'npm'
}
