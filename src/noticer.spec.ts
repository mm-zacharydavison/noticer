import { execSync, spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

describe('noticer CLI', () => {
  const tmpDir = path.join(os.tmpdir(), `noticer-test-${Date.now()}`)
  const noticesDir = path.join(tmpDir, '.noticer', 'notices')
  const seenNoticesPath = path.join(tmpDir, '.noticer', 'seen.json')
  const cliPath = path.resolve(__dirname, '../dist/bin/noticer.js')

  beforeEach(() => {
    // Create test directories
    fs.ensureDirSync(tmpDir)
    fs.ensureDirSync(noticesDir)

    // Initialize basic .git dir for tests
    fs.ensureDirSync(path.join(tmpDir, '.git'))

    // Clear any existing files
    fs.emptyDirSync(tmpDir)
    fs.ensureDirSync(noticesDir)
    fs.ensureDirSync(path.join(tmpDir, '.git'))

    // Override the path used in the actual implementation
    process.env.HOME = tmpDir

    // Create a basic package.json for all init tests
    fs.writeJsonSync(path.join(tmpDir, 'package.json'), {
      name: 'test-package',
    })
  })

  afterEach(() => {
    // Clean up
    fs.removeSync(tmpDir)
  })

  describe('init', () => {
    it('WILL install itself into the postinstall script with npm by default', () => {
      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const pkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
      expect(pkg.scripts.postinstall).toBe('npm noticer show')
    })

    it('WILL use pnpm when pnpm-lock.yaml exists', () => {
      // Create pnpm lock file
      fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '')

      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const pkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
      expect(pkg.scripts.postinstall).toBe('pnpm noticer show')
    })

    it('WILL use yarn when yarn.lock exists', () => {
      // Create yarn lock file
      fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '')

      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const pkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
      expect(pkg.scripts.postinstall).toBe('yarn noticer show')
    })

    it('WILL use bun when bun.lockb exists', () => {
      // Create bun lock file
      fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '')

      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const pkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
      expect(pkg.scripts.postinstall).toBe('bun noticer show')
    })

    it('WILL add `.noticer/seen.json` to .gitignore', () => {
      // Create empty .gitignore
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), '')

      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')
      expect(gitignore).toContain('.noticer/seen.json')
    })

    it('Multiple runs of `init` are idempotent', () => {
      // First run
      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const firstRunPkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
      const firstRunGitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')

      // Second run
      execSync(`node ${cliPath} init`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      })

      const secondRunPkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
      const secondRunGitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')

      // Verify results are identical
      expect(secondRunPkg).toEqual(firstRunPkg)
      expect(secondRunGitignore).toBe(firstRunGitignore)
    })

    describe('.jj support', () => {
      it('WILL support .jj for version control.', () => {
        // Create .jj directory instead of .git
        fs.removeSync(path.join(tmpDir, '.git'))
        fs.ensureDirSync(path.join(tmpDir, '.jj'))

        execSync(`node ${cliPath} init`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        })

        // Check that .noticer/seen.json is added to .gitignore
        const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8')
        expect(gitignore).toContain('.noticer/seen.json')

        // Check that package.json is still updated
        const pkg = fs.readJsonSync(path.join(tmpDir, 'package.json'))
        expect(pkg.scripts.postinstall).toBe('npm noticer show')
      })
    })
  })

  describe('create', () => {
    describe('[without a message argument]', () => {
      it.todo('WILL launch an interactive preview mode that allows writing a message.')
    })
    describe('[with a message argument]', () => {
      it('WILL create a new notice file', () => {
        // Run the create command and capture output
        execSync(`node ${cliPath} create --author "Test Author" "Test Content"`, {
          env: { ...process.env, HOME: tmpDir },
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: tmpDir,
        })

        // Check if a notice file was created
        const files = fs.readdirSync(noticesDir)
        expect(files.length).toBe(1)
        expect(files[0]).toMatch(/^\d{8}_\d{6}\.json$/)

        // Check the content of the notice file
        const noticeContent = fs.readJsonSync(path.join(noticesDir, files[0]))
        expect(noticeContent).toMatchObject({
          author: 'Test Author',
          content: 'Test Content',
        })
        expect(noticeContent).toHaveProperty('date')
      })

      it('WILL set the author from the git config, if it exists', () => {
        // Initialize git repo first
        execSync('git init', { cwd: tmpDir })
        execSync('git config user.name "Git User"', {
          cwd: tmpDir,
        })

        // Create notice without specifying author
        execSync(`node ${cliPath} create "Test Content"`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        })

        const files = fs.readdirSync(noticesDir)
        const noticeContent = fs.readJsonSync(path.join(noticesDir, files[0]))
        expect(noticeContent.author).toBe('Git User')
      })
    })
  })

  describe('show', () => {
    it('WILL display unseen notices and mark them as seen', () => {
      // Create a test notice
      const noticeId = 'notice-test'
      const noticeContent = {
        content: 'Test notice content',
        author: 'Test Author',
        date: new Date().toISOString(),
      }

      fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

      // Capture stdout
      const stdout = execSync(`node ${cliPath} show`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      }).toString()

      // Check if the notice was displayed
      expect(stdout).toContain('Test notice content')
      expect(stdout).toContain('Test Author')

      // Check if the notice was marked as seen
      const seenNotices = fs.readJsonSync(seenNoticesPath)
      expect(seenNotices).toHaveProperty(noticeId, true)

      // Run again and make sure no notices are shown
      const secondRun = execSync(`node ${cliPath} show`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      }).toString()

      expect(secondRun).not.toContain('Test notice content')
    })

    it('WILL not show anything when there are no notices', () => {
      // Capture stdout
      const stdout = execSync(`node ${cliPath} show`, {
        env: { ...process.env, HOME: tmpDir },
        cwd: tmpDir,
      }).toString()

      // Check that no notices were displayed
      expect(stdout.trim()).toBe('')
    })

    describe('On a fresh clone', () => {
      it('ONLY the latest notice is printed the first time `show` is used.', () => {
        // Create a notices directory structure
        const noticesDir = path.join(tmpDir, '.noticer', 'notices')
        fs.mkdirpSync(noticesDir)

        // Create multiple test notices with different timestamps
        const notices = [
          {
            id: 'notice-oldest',
            content: {
              content: 'Oldest notice content',
              author: 'Test Author 1',
              date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            },
          },
          {
            id: 'notice-middle',
            content: {
              content: 'Middle notice content',
              author: 'Test Author 2',
              date: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
            },
          },
          {
            id: 'notice-latest',
            content: {
              content: 'Latest notice content',
              author: 'Test Author 3',
              date: new Date().toISOString(), // Now
            },
          },
        ]

        // Write the notices to files
        for (const notice of notices) {
          fs.writeJsonSync(path.join(noticesDir, `${notice.id}.json`), notice.content, {
            spaces: 2,
          })
        }

        // Capture stdout
        const stdout = execSync(`node ${cliPath} show`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Check that only the latest notice was displayed
        expect(stdout).toContain('Latest notice content')
        expect(stdout).toContain('Test Author 3')

        // Check that older notices were not displayed
        expect(stdout).not.toContain('Oldest notice content')
        expect(stdout).not.toContain('Test Author 1')
        expect(stdout).not.toContain('Middle notice content')
        expect(stdout).not.toContain('Test Author 2')

        // Check that only the latest notice was marked as seen
        const seenNoticesPath = path.join(tmpDir, '.noticer', 'seen.json')
        const seenNotices = fs.readJsonSync(seenNoticesPath)
        expect(seenNotices).toHaveProperty('notice-oldest', true)
        expect(seenNotices).toHaveProperty('notice-middle', true)
        expect(seenNotices).toHaveProperty('notice-latest', true)
        // Older notices should all be marked as seen.
        expect(Object.keys(seenNotices)).toHaveLength(3)
      })

      it('ALL notices are marked as seen the first time `show` is used.', () => {
        // Create multiple test notices
        const notices = [
          {
            id: 'notice-1',
            content: {
              content: 'First notice',
              author: 'Author 1',
              date: new Date(Date.now() - 3600000).toISOString(),
            },
          },
          {
            id: 'notice-2',
            content: {
              content: 'Second notice',
              author: 'Author 2',
              date: new Date().toISOString(),
            },
          },
        ]

        // Write the notices to files
        for (const notice of notices) {
          fs.writeJsonSync(path.join(noticesDir, `${notice.id}.json`), notice.content, {
            spaces: 2,
          })
        }

        // Run show command first time
        execSync(`node ${cliPath} show`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        })

        // Verify all notices are marked as seen
        const seenNotices = fs.readJsonSync(seenNoticesPath)
        expect(Object.keys(seenNotices).length).toBe(2)
        expect(seenNotices).toHaveProperty('notice-1', true)
        expect(seenNotices).toHaveProperty('notice-2', true)
      })
    })

    describe('-n', () => {
      it('WILL show the last `n` notices when `-n` is provided', () => {
        // Initialize seen.json with empty object
        fs.writeJsonSync(seenNoticesPath, {})

        // Create multiple test notices
        const notices = [
          {
            id: 'notice-1',
            content: {
              content: 'First notice',
              author: 'Author 1',
              date: new Date(Date.now() - 3600000).toISOString(),
            },
          },
          {
            id: 'notice-2',
            content: {
              content: 'Second notice',
              author: 'Author 2',
              date: new Date(Date.now() - 1800000).toISOString(),
            },
          },
          {
            id: 'notice-3',
            content: {
              content: 'Third notice',
              author: 'Author 3',
              date: new Date().toISOString(),
            },
          },
        ]

        // Write the notices to files
        for (const notice of notices) {
          fs.writeJsonSync(path.join(noticesDir, `${notice.id}.json`), notice.content, {
            spaces: 2,
          })
        }

        const stdout = execSync(`node ${cliPath} show -n 2`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should show last 2 notices
        expect(stdout).toContain('Third notice')
        expect(stdout).toContain('Second notice')
        expect(stdout).not.toContain('First notice')

        // Should mark shown notices as seen
        const seenNotices = fs.readJsonSync(seenNoticesPath)
        expect(seenNotices).toHaveProperty('notice-3', true)
        expect(seenNotices).toHaveProperty('notice-2', true)
        expect(seenNotices).not.toHaveProperty('notice-1')
      })

      it('Even if a notice has been seen, it will be shown when using `-n`', () => {
        // Create test notices
        const notices = [
          {
            id: 'notice-1',
            content: {
              content: 'First notice',
              author: 'Author 1',
              date: new Date(Date.now() - 3600000).toISOString(),
            },
          },
          {
            id: 'notice-2',
            content: {
              content: 'Second notice',
              author: 'Author 2',
              date: new Date().toISOString(),
            },
          },
        ]

        // Write notices and mark them as seen
        for (const notice of notices) {
          fs.writeJsonSync(path.join(noticesDir, `${notice.id}.json`), notice.content, {
            spaces: 2,
          })
        }
        fs.writeJsonSync(seenNoticesPath, {
          'notice-1': true,
          'notice-2': true,
        })

        const stdout = execSync(`node ${cliPath} show -n 2`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should show both notices even though they're marked as seen
        expect(stdout).toContain('First notice')
        expect(stdout).toContain('Second notice')
      })
    })

    describe('command execution', () => {
      it('WILL detect and display commands prefixed with !>', () => {
        // Create a test notice with a command
        const noticeId = 'notice-with-command'
        const noticeContent = {
          content: 'Test notice with command:\n!> echo "Hello from test command"',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command - command detection is verified by the content being displayed
        // and --auto-execute working (tested separately)
        const stdout = execSync(`node ${cliPath} show </dev/null`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Check if the notice was displayed with the command syntax
        expect(stdout).toContain('Test notice with command')
        expect(stdout).toContain('!> echo "Hello from test command"')
      })

      it('WILL execute commands when using --auto-execute', () => {
        // Create a test notice with a simple command
        const noticeId = 'notice-with-simple-command'
        const noticeContent = {
          content: 'Test notice with command:\n!> echo "Command executed successfully"',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command with --auto-execute
        const stdout = execSync(`node ${cliPath} show --auto-execute`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should show the execution message
        expect(stdout).toContain('Executing: echo "Command executed successfully"')
      })

      it('WILL not execute commands when no TTY is available and --auto-execute is not passed', () => {
        // Create a test notice with a command
        const noticeId = 'notice-with-command-declined'
        const noticeContent = {
          content: 'Test notice with command:\n!> echo "This should not execute"',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command with stdin closed (simulating non-TTY)
        const stdout = execSync(`node ${cliPath} show </dev/null`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should display the notice but not execute the command
        expect(stdout).toContain('Test notice with command')
        expect(stdout).not.toContain('Executing: echo "This should not execute"')
      })

      it('WILL ignore lines that do not start with !>', () => {
        // Create a test notice with text that looks like commands but isn't
        const noticeId = 'notice-with-fake-commands'
        const noticeContent = {
          content: 'This is not a command: > echo "not a command"\nThis is also not: !echo "also not"\nThis IS a command:\n!> echo "real command"',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command with --auto-execute to verify only the real command runs
        const stdout = execSync(`node ${cliPath} show --auto-execute`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should execute only the real command
        expect(stdout).toContain('Executing: echo "real command"')
        // Should not execute the fake commands
        expect(stdout).not.toContain('Executing: echo "not a command"')
        expect(stdout).not.toContain('Executing: echo "also not"')
      })

      it('WILL execute local scripts with relative paths from repo root', () => {
        // Create a test script in the repo
        const scriptsDir = path.join(tmpDir, 'scripts')
        fs.ensureDirSync(scriptsDir)
        const scriptPath = path.join(scriptsDir, 'test-script.sh')
        fs.writeFileSync(scriptPath, '#!/bin/bash\necho "Script executed from: $(pwd)"', { mode: 0o755 })

        // Create a test notice with a relative path command
        const noticeId = 'notice-with-relative-script'
        const noticeContent = {
          content: 'Run setup script:\n!> ./scripts/test-script.sh',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command with --auto-execute
        const stdout = execSync(`node ${cliPath} show --auto-execute`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should show the execution attempt
        expect(stdout).toContain('Executing: ./scripts/test-script.sh')

        // Verify the script file exists and is executable
        expect(fs.existsSync(scriptPath)).toBe(true)
        const stats = fs.statSync(scriptPath)
        expect(stats.mode & 0o111).not.toBe(0) // Check execute permissions
      })

      it('WILL fail gracefully when local script does not exist', () => {
        // Create a test notice with a non-existent script
        const noticeId = 'notice-with-missing-script'
        const noticeContent = {
          content: 'Run missing script:\n!> ./scripts/missing-script.sh',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command with --auto-execute
        let output = ''
        try {
          output = execSync(`node ${cliPath} show --auto-execute`, {
            env: { ...process.env, HOME: tmpDir },
            cwd: tmpDir,
            stdio: 'pipe'
          }).toString()
        } catch (error: unknown) {
          const execError = error as { stdout?: Buffer }
          output = execError.stdout ? execError.stdout.toString() : ''
        }

        // Should show the execution attempt - the script execution itself may fail
        // but the noticer command should complete successfully
        expect(output).toContain('Executing: ./scripts/missing-script.sh')
      })

      it('WILL execute scripts with --auto-execute', () => {
        // Create a simple test script
        const scriptsDir = path.join(tmpDir, 'scripts')
        fs.ensureDirSync(scriptsDir)
        const scriptPath = path.join(scriptsDir, 'simple-script.sh')
        const scriptContent = `#!/bin/bash
echo "Script executed successfully"
`
        fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })

        // Create a test notice with a script command
        const noticeId = 'notice-with-script'
        const noticeContent = {
          content: 'Run setup:\n!> ./scripts/simple-script.sh',
          author: 'Test Author',
          date: new Date().toISOString(),
        }

        fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

        // Run show command with --auto-execute
        const stdout = execSync(`node ${cliPath} show --auto-execute`, {
          env: { ...process.env, HOME: tmpDir },
          cwd: tmpDir,
        }).toString()

        // Should show the execution attempt
        expect(stdout).toContain('Executing: ./scripts/simple-script.sh')
      })

      describe('--auto-execute', () => {
        it('WILL execute commands without prompting when --auto-execute is passed', () => {
          // Create a test notice with a command
          const noticeId = 'notice-auto-execute'
          const noticeContent = {
            content: 'Auto-execute test:\n!> echo "Auto executed"',
            author: 'Test Author',
            date: new Date().toISOString(),
          }

          fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

          // Run show command with --auto-execute (no user input needed)
          const stdout = execSync(`node ${cliPath} show --auto-execute`, {
            env: { ...process.env, HOME: tmpDir },
            cwd: tmpDir,
          }).toString()

          // Should execute without prompting
          expect(stdout).toContain('Executing: echo "Auto executed"')
          // Should NOT show the prompt
          expect(stdout).not.toContain('Execute command:')
        })

        it('WILL execute multiple commands in sequence with --auto-execute', () => {
          // Create a test notice with multiple commands
          const noticeId = 'notice-multi-auto-execute'
          const noticeContent = {
            content: 'Multi-command test:\n!> echo "First command"\n!> echo "Second command"',
            author: 'Test Author',
            date: new Date().toISOString(),
          }

          fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

          // Run show command with --auto-execute
          const stdout = execSync(`node ${cliPath} show --auto-execute`, {
            env: { ...process.env, HOME: tmpDir },
            cwd: tmpDir,
          }).toString()

          // Both commands should be executed
          expect(stdout).toContain('Executing: echo "First command"')
          expect(stdout).toContain('Executing: echo "Second command"')
        })

        it('WILL continue executing remaining commands even if one fails with --auto-execute', () => {
          // Create a test notice with a failing command followed by a working one
          const noticeId = 'notice-fail-continue'
          const noticeContent = {
            content: 'Fail and continue:\n!> exit 1\n!> echo "After failure"',
            author: 'Test Author',
            date: new Date().toISOString(),
          }

          fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

          // Run show command with --auto-execute
          let output = ''
          try {
            output = execSync(`node ${cliPath} show --auto-execute`, {
              env: { ...process.env, HOME: tmpDir },
              cwd: tmpDir,
              stdio: 'pipe'
            }).toString()
          } catch (error: unknown) {
            const execError = error as { stdout?: Buffer }
            output = execError.stdout ? execError.stdout.toString() : ''
          }

          // Should attempt to execute both commands
          expect(output).toContain('Executing: exit 1')
          expect(output).toContain('Executing: echo "After failure"')
        })
      })

      describe('TTY fallback', () => {
        it('WILL skip command prompts when stdin is not a TTY and /dev/tty is unavailable', () => {
          // Create a test notice with a command
          const noticeId = 'notice-no-tty'
          const noticeContent = {
            content: 'No TTY test:\n!> echo "Should be skipped"',
            author: 'Test Author',
            date: new Date().toISOString(),
          }

          fs.writeJsonSync(path.join(noticesDir, `${noticeId}.json`), noticeContent, { spaces: 2 })

          // Run show command with stdin closed (simulating non-TTY without /dev/tty)
          // Using </dev/null to close stdin
          const stdout = execSync(`node ${cliPath} show </dev/null`, {
            env: { ...process.env, HOME: tmpDir },
            cwd: tmpDir,
          }).toString()

          // Notice should be displayed but command should NOT be executed or prompted
          expect(stdout).toContain('No TTY test')
          expect(stdout).not.toContain('Executing:')
          // The prompt behavior depends on /dev/tty availability
        })

        it.skip('WILL re-open /dev/tty if stdin is not a TTY.') // hard to test without actual shell
      })
    })
  })
})
