import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendRoot = path.resolve(__dirname, '..')
const vitestCliPath = path.join(frontendRoot, 'node_modules', 'vitest', 'vitest.mjs')
const domConfigPath = path.join(frontendRoot, 'vitest.dom.config.ts')
const preflightTimeoutMs = 8000

const cliArgs = parseArgs(process.argv.slice(2))
const cwdRealPath = safeRealpath(process.cwd())
const knownUnsupportedReason = detectKnownUnsupportedEnvironment(cwdRealPath)

if (knownUnsupportedReason) {
  printUnsupportedEnvironmentMessage(knownUnsupportedReason, cwdRealPath)
  process.exit(1)
}

const preflightResult = await runDomPreflight({
  cwd: frontendRoot,
  timeoutMs: preflightTimeoutMs,
})

if (!preflightResult.ok) {
  printPreflightFailureMessage(preflightResult)
  process.exit(1)
}

const vitestArgs = buildVitestArgs(cliArgs)
const exitCode = await runVitest(vitestArgs)
process.exit(exitCode)

function parseArgs(args) {
  const passthroughArgs = []
  let mode = 'watch'

  for (const arg of args) {
    if (arg === '--run') {
      mode = 'run'
      continue
    }

    if (arg === '--watch') {
      mode = 'watch'
      continue
    }

    passthroughArgs.push(arg)
  }

  return { mode, passthroughArgs }
}

function buildVitestArgs({ mode, passthroughArgs }) {
  const args = []

  if (mode === 'run') {
    args.push('run')
  }

  args.push('--config', domConfigPath)
  args.push(...passthroughArgs)

  return args
}

function safeRealpath(targetPath) {
  try {
    return fs.realpathSync(targetPath)
  } catch {
    return path.resolve(targetPath)
  }
}

function detectKnownUnsupportedEnvironment(cwdPath) {
  const release = os.release().toLowerCase()
  const isWsl = release.includes('microsoft') || Boolean(process.env.WSL_DISTRO_NAME)
  const isMountedWindowsPath = /^\/mnt\/[a-z]\//i.test(cwdPath)

  if (isWsl && isMountedWindowsPath) {
    return 'WSL detected on a /mnt/... Windows-mounted path'
  }

  return null
}

function runDomPreflight({ cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        [
          "await import('jsdom')",
          "await import('@testing-library/jest-dom/vitest')",
          "process.stdout.write('dom-preflight-ok\\n')",
        ].join(';'),
      ],
      {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      settled = true
      child.kill('SIGKILL')
      resolve({
        ok: false,
        type: 'timeout',
        timeoutMs,
        stdout,
        stderr,
      })
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (error) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      resolve({
        ok: false,
        type: 'spawn-error',
        error,
        stdout,
        stderr,
      })
    })

    child.on('exit', (code, signal) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)

      if (code === 0) {
        resolve({ ok: true })
        return
      }

      resolve({
        ok: false,
        type: 'exit-error',
        code,
        signal,
        stdout,
        stderr,
      })
    })
  })
}

function runVitest(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [vitestCliPath, ...args], {
      cwd: frontendRoot,
      stdio: 'inherit',
    })

    child.on('error', () => resolve(1))
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve(1)
        return
      }

      resolve(code ?? 1)
    })
  })
}

function printUnsupportedEnvironmentMessage(reason, cwdPath) {
  console.error('[vitest-dom] DOM test execution was blocked before starting.')
  console.error(`[vitest-dom] Reason: ${reason}.`)
  console.error(`[vitest-dom] Current working directory: ${cwdPath}`)
  console.error(
    '[vitest-dom] In this environment, jsdom or @testing-library/jest-dom/vitest can hang during import, so the runner exits early with a non-zero code instead of appearing stuck.',
  )
  printRecommendations()
}

function printPreflightFailureMessage(result) {
  console.error('[vitest-dom] DOM test execution was blocked before starting.')

  if (result.type === 'timeout') {
    console.error(
      `[vitest-dom] Reason: jsdom/@testing-library preflight did not finish within ${result.timeoutMs}ms.`,
    )
    console.error(
      '[vitest-dom] This is treated as an environment/runtime issue, not as an application test failure.',
    )
  } else if (result.type === 'spawn-error') {
    console.error(`[vitest-dom] Reason: failed to start the DOM preflight process: ${result.error.message}`)
  } else {
    console.error('[vitest-dom] Reason: DOM preflight exited before tests could start.')
    if (typeof result.code === 'number') {
      console.error(`[vitest-dom] Preflight exit code: ${result.code}`)
    }
    if (result.signal) {
      console.error(`[vitest-dom] Preflight signal: ${result.signal}`)
    }
  }

  if (result.stderr?.trim()) {
    console.error('[vitest-dom] Preflight stderr:')
    console.error(result.stderr.trim())
  }

  printRecommendations()
}

function printRecommendations() {
  console.error('[vitest-dom] Recommended locations for DOM tests:')
  console.error('[vitest-dom] - Move the repository into the WSL Ubuntu home directory and run there.')
  console.error('[vitest-dom] - Or run the same commands from a native Windows path/terminal.')
  console.error('[vitest-dom] Commands:')
  console.error('[vitest-dom] - npm test')
  console.error('[vitest-dom] - npm run test:verify')
  console.error('[vitest-dom] - npm run test:node')
  console.error('[vitest-dom] - npm run test:node:quick')
  console.error('[vitest-dom] - npm run test:node:full')
  console.error('[vitest-dom] - npm run test:date-text')
  console.error('[vitest-dom] - npm run test:dom')
  console.error('[vitest-dom] - npm run test:dom:watch')
  console.error('[vitest-dom] - npm run test:statistics-page')
}
