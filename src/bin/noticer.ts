#!/usr/bin/env node
import { execSync } from 'node:child_process'
import path from 'node:path'
import * as readline from 'node:readline'
import { program } from 'commander'
import fs from 'fs-extra'
import prompts from 'prompts'
import { getNoticesDir, getRepoRoot, printNotice, run, detectPackageManager } from '../lib.js'
import type { Notice } from '../lib.js'

program
  .name('noticer')
  .description('A tool for notifying developers of things they need to know in a repository.')
  .version('1.0.0')

program
  .command('show')
  .description('Show unseen notices, and mark them as read.')
  .option('-n, --number <number>', 'Show last N notices, even if already seen')
  .action((options) => {
    run(options.number ? Number.parseInt(options.number, 10) : undefined)
  })

interface CreateNoticeOptions {
  content: string
  author: string
  noticesDir: string
}

function createNoticeFile({ content, author, noticesDir }: CreateNoticeOptions): string {
  const id = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_')
  const notice = {
    content,
    author,
    date: new Date().toISOString(),
  }

  fs.writeJsonSync(path.join(noticesDir, `${id}.json`), notice, {
    spaces: 2,
  })
  return id
}

async function createNoticeInteractive(author: string): Promise<string> {
  console.log('📝 Enter your notice content below. You will see a live preview as you type.')
  console.log('Press Enter to add a new line. Press Enter twice to finish.')

  const lines: string[] = []
  let currentLine = ''

  for (;;) {
    const response = await prompts({
      type: 'text',
      name: 'line',
      message: '>',
      initial: currentLine,
      onState: (state) => {
        if (state.value) {
          // Clear previous preview
          process.stdout.write('\x1Bc')
          // Show preview
          const previewNotice: Notice = {
            id: 'preview',
            content: [...lines, state.value].join('\n'),
            author,
            date: new Date().toISOString(),
          }
          printNotice(previewNotice)
        }
      },
    })

    if (!response.line) {
      break
    }

    lines.push(response.line)
    currentLine = ''
  }

  const content = lines.join('\n')
  if (!content) {
    console.error('❌ Notice content is required')
    process.exit(1)
  }

  return content
}

program
  .command('create [content]')
  .description('Create a new notice')
  .option('-a, --author <author>', 'The author of the notice (defaults to git user)')
  .action(async (content, options) => {
    try {
      const repoRoot = getRepoRoot()
      const noticesDir = getNoticesDir(repoRoot)

      if (!fs.existsSync(noticesDir)) {
        fs.mkdirpSync(noticesDir)
      }

      // Get author from git config if not provided
      let author = options.author
      if (!author) {
        try {
          author = execSync('git config user.name', { encoding: 'utf8' }).trim()
        } catch (error) {
          console.error('❌ Could not get git user name. Please provide --author option.')
          process.exit(1)
        }
      }

      // If content is provided as argument, use it directly
      const noticeContent = content || (await createNoticeInteractive(author))
      const id = createNoticeFile({
        content: noticeContent,
        author,
        noticesDir,
      })
      console.log(`🪧 Notice created: ${id}`)
    } catch (error) {
      console.error('❌ Error creating notice:', error)
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Initialize noticer in the current repository')
  .action(() => {
    const repoRoot = getRepoRoot()

    // Add to package.json postinstall
    const pkgPath = path.join(repoRoot, 'package.json')
    const pkg = fs.readJsonSync(pkgPath)
    pkg.scripts = pkg.scripts || {}

    // Detect package manager and create the command
    const packageManager = detectPackageManager(repoRoot)
    const noticerCommand = `${packageManager} noticer show`

    // Only add the command if it's not already there
    if (!pkg.scripts.postinstall?.includes(noticerCommand)) {
      pkg.scripts.postinstall = pkg.scripts.postinstall
        ? `${pkg.scripts.postinstall} && ${noticerCommand}`
        : noticerCommand
      fs.writeJsonSync(pkgPath, pkg, { spaces: 2 })
      console.log('🪧 Noticer added itself to your "postinstall" script.')
    }

    // Add to .gitignore (always create if doesn't exist)
    const gitignorePath = path.join(repoRoot, '.gitignore')
    const gitignoreContent = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, 'utf8')
      : ''

    if (!gitignoreContent.includes('.noticer/seen.json')) {
      fs.appendFileSync(gitignorePath, '\n# @meetsmore/noticer, record of notices seen by you.')
      fs.appendFileSync(gitignorePath, '\n.noticer/seen.json\n')
      console.log('🪧 Noticer added ".noticer/seen.json" to your .gitignore.')
    }

    console.log('✅ Noticer initialized successfully')
  })

program.parse()
