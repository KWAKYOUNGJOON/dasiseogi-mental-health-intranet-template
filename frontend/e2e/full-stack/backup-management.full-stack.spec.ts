import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const USER_LOGIN_ID = 'usera'
const DEFAULT_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const RESTORE_CONFIRMATION_TEXT = '전체 복원을 실행합니다'
const SPEC_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = path.resolve(SPEC_DIRECTORY, '../..')
const REPOSITORY_ROOT = path.resolve(FRONTEND_ROOT, '..')
const DEFAULT_BACKUP_HOST_ROOT = path.join(REPOSITORY_ROOT, 'local-backups')
const CONFIGURED_BACKUP_HOST_ROOT = readConfiguredBackupHostRoot()

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function normalizeConfiguredHostPath(value: string) {
  const unquoted = value.replace(/^['"]|['"]$/g, '').trim()

  if (!unquoted) {
    return null
  }

  if (/^[A-Za-z]:[\\/]/.test(unquoted)) {
    const normalizedWindowsPath = unquoted.replace(/\\/g, '/')
    return `/mnt/${normalizedWindowsPath[0].toLowerCase()}${normalizedWindowsPath.slice(2)}`
  }

  return path.isAbsolute(unquoted) ? unquoted : path.resolve(REPOSITORY_ROOT, unquoted)
}

function readConfiguredBackupHostRoot() {
  const envPath = path.join(REPOSITORY_ROOT, '.env')

  if (!fs.existsSync(envPath)) {
    return null
  }

  const envContent = fs.readFileSync(envPath, 'utf8')

  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')

    if (separatorIndex < 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()

    if (key !== 'BACKEND_BACKUPS_HOST_PATH') {
      continue
    }

    return normalizeConfiguredHostPath(line.slice(separatorIndex + 1))
  }

  return null
}

function extractBackupFileNameFromNotice(text: string) {
  const match = text.match(/(backup-[A-Za-z0-9._-]+\.(?:zip|sql))/i)

  if (!match) {
    throw new Error(`Could not extract a backup file name from notice text: ${text}`)
  }

  return match[1]
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
}

async function login(page: Page, loginId: string, password: string, expectedName: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user')).toContainText(expectedName)
}

function getBackupCountText(page: Page) {
  return page.getByText(/^총 \d+건$/).first()
}

async function readBackupCount(page: Page) {
  const text = (await getBackupCountText(page).textContent())?.trim() ?? ''
  const match = text.match(/^총 (\d+)건$/)

  if (!match) {
    throw new Error(`Could not parse backup count text: ${text}`)
  }

  return Number(match[1])
}

function getBackupRowByFileName(page: Page, fileName: string) {
  return page
    .locator('table')
    .filter({ has: page.getByRole('columnheader', { name: '백업 ID' }) })
    .locator('tbody tr')
    .filter({ hasText: fileName })
    .first()
}

function getRestoreRowByFileName(page: Page, fileName: string) {
  return page
    .locator('table')
    .filter({ has: page.getByRole('columnheader', { name: 'restoreId' }) })
    .locator('tbody tr')
    .filter({ hasText: fileName })
    .first()
}

function getRestoreUploadCard(page: Page) {
  return page.locator('.card').filter({ has: page.getByText('복원 ZIP 업로드') }).first()
}

function getRestoreDetailCard(page: Page) {
  return page.locator('.card').filter({ has: page.getByText('선택한 복원 검증 상세') }).first()
}

function getRestorePreparationCard(page: Page) {
  return page.locator('.card').filter({ has: page.getByText('복원 실행 준비') }).first()
}

function resolveBackupHostPath(fileName: string, displayedFilePath: string) {
  const candidates = [
    displayedFilePath,
    CONFIGURED_BACKUP_HOST_ROOT ? path.join(CONFIGURED_BACKUP_HOST_ROOT, fileName) : null,
    path.join(DEFAULT_BACKUP_HOST_ROOT, fileName),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(`Could not resolve backup host path for ${fileName}. Tried: ${candidates.join(', ')}`)
}

async function readBackupFilePath(row: Locator) {
  const cells = (await row.getByRole('cell').allTextContents()).map((value) => value.trim())

  if (cells.length < 5) {
    throw new Error(`Could not parse backup row cells: ${cells.join(' | ')}`)
  }

  return cells[4]
}

async function expectBackupMetadataRow(
  row: Locator,
  input: {
    fileName: string
    executedByName: string
  },
) {
  await expect(row).toBeVisible()

  const cells = (await row.getByRole('cell').allTextContents()).map((value) => value.trim())

  expect(cells).toHaveLength(10)
  expect(cells[0]).toMatch(/^\d+$/)
  expect(cells[1]).toBe('MANUAL')
  expect(cells[2]).toBe('SUCCESS')
  expect(cells[3]).toBe(input.fileName)
  expect(cells[4]).toContain(input.fileName)
  expect(cells[5]).toMatch(/^\d+(?:\.\d)?\s(?:B|KB|MB)$/)
  expect(cells[6]).not.toBe('-')
  expect(cells[7]).not.toBe('-')
  expect(cells[8]).toBe(input.executedByName)
  expect(cells[9]).toBe('-')
}

test.describe('실브라우저 백업 관리', () => {
  test('관리자가 백업을 생성하면 목록과 현재 UI의 다운로드 노출 상태가 반영된다 @full-stack-smoke', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const reason = `Playwright backup management ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    await page.getByRole('link', { name: '백업 관리' }).click()

    await expect(page).toHaveURL(/\/admin\/backups$/)
    await expect(page.getByRole('heading', { name: '백업 관리' })).toBeVisible()
    await expect(page.getByRole('button', { name: '수동 백업 실행' })).toBeVisible()
    const reloadButton = page.getByRole('button', { name: '재조회' }).first()

    await expect(reloadButton).toBeVisible()
    await expect(page.getByText('백업 파일 다운로드나 삭제는 이번 화면 범위에 포함하지 않습니다.')).toBeVisible()

    const baselineCount = await readBackupCount(page)

    await page.getByRole('button', { name: '수동 백업 실행' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '수동 백업 실행 확인' })).toBeVisible()
    await dialog.getByLabel('실행 사유').fill(reason)
    await dialog.getByRole('button', { name: '백업 실행' }).click()

    const notice = page.getByRole('status')
    await expect(notice).toContainText('수동 백업을 실행했습니다.')

    const noticeText = (await notice.textContent())?.trim() ?? ''
    const fileName = extractBackupFileNameFromNotice(noticeText)
    const createdRow = getBackupRowByFileName(page, fileName)

    await expect.poll(async () => readBackupCount(page)).toBe(baselineCount + 1)
    await expect(createdRow).toBeVisible()
    await expectBackupMetadataRow(createdRow, {
      fileName,
      executedByName: '관리자A',
    })

    await reloadButton.click()

    await expect(getBackupCountText(page)).toHaveText(`총 ${baselineCount + 1}건`)
    await expect(createdRow).toBeVisible()
    await expectBackupMetadataRow(createdRow, {
      fileName,
      executedByName: '관리자A',
    })

    await expect(page.getByRole('button', { name: /다운로드/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /다운로드/ })).toHaveCount(0)
    await expect(createdRow.getByRole('link')).toHaveCount(0)
  })

  test('일반 사용자는 백업 관리 화면에 접근할 수 없다', async ({ page }) => {
    await login(page, USER_LOGIN_ID, DEFAULT_PASSWORD, '사용자A')

    await expect(page.getByRole('link', { name: '백업 관리' })).toHaveCount(0)

    await page.goto('/admin/backups')

    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  })

  test('관리자는 VALIDATED restore 상세를 보고 확인 문구 검증 후 실제 복원 실행까지 완료할 수 있다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const reason = `Playwright restore management ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    await page.getByRole('link', { name: '백업 관리' }).click()

    await expect(page).toHaveURL(/\/admin\/backups$/)
    await expect(page.getByRole('heading', { name: '백업 관리' })).toBeVisible()

    await page.getByRole('button', { name: '수동 백업 실행' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '수동 백업 실행 확인' })).toBeVisible()
    await dialog.getByLabel('실행 사유').fill(reason)
    await dialog.getByRole('button', { name: '백업 실행' }).click()

    const backupNotice = page.getByRole('status').first()
    await expect(backupNotice).toContainText('수동 백업을 실행했습니다.')
    await expect(backupNotice).toContainText('DB_DUMP')

    const backupNoticeText = (await backupNotice.textContent())?.trim() ?? ''
    const backupFileName = extractBackupFileNameFromNotice(backupNoticeText)
    const backupRow = getBackupRowByFileName(page, backupFileName)

    await expect(backupRow).toBeVisible()
    await expectBackupMetadataRow(backupRow, {
      fileName: backupFileName,
      executedByName: '관리자A',
    })

    const displayedBackupFilePath = await readBackupFilePath(backupRow)
    const backupHostPath = resolveBackupHostPath(backupFileName, displayedBackupFilePath)

    await expect.poll(() => fs.existsSync(backupHostPath)).toBe(true)

    const restoreUploadCard = getRestoreUploadCard(page)
    await restoreUploadCard.locator('input[type="file"]').setInputFiles(backupHostPath)
    await expect(restoreUploadCard).toContainText(`선택한 파일: ${backupFileName}`)

    await restoreUploadCard.getByRole('button', { name: '업로드' }).click()

    const restoreUploadNotice = restoreUploadCard.getByRole('status')
    await expect(restoreUploadNotice).toContainText(`${backupFileName} 업로드/검증이 완료되었습니다.`)
    await expect(restoreUploadNotice).toContainText('현재 버전에서 복원 실행 가능합니다.')

    const restoreRow = getRestoreRowByFileName(page, backupFileName)
    const restoreDetailCard = getRestoreDetailCard(page)
    const restorePreparationCard = getRestorePreparationCard(page)

    await expect(restoreRow).toBeVisible()
    await expect(restoreRow).toContainText('VALIDATED')
    await expect(restoreDetailCard).toContainText('VALIDATED')
    await expect(restoreDetailCard).toContainText(backupFileName)
    await expect(restoreDetailCard).toContainText('MARIADB')

    await expect(restorePreparationCard).toContainText('DATABASE')
    await expect(restorePreparationCard).toContainText('db/database.sql')

    const databaseCheckbox = restorePreparationCard.getByRole('checkbox')
    const confirmationTextarea = restorePreparationCard.getByLabel('복원 실행 확인 문구')
    const executeButton = restorePreparationCard.getByRole('button', { name: '복원 실행' })

    await expect(databaseCheckbox).toBeEnabled()
    await databaseCheckbox.check()
    await expect(restorePreparationCard).toContainText('현재 선택 1개')
    await expect(confirmationTextarea).toBeEditable()

    await confirmationTextarea.fill('전체 복원을 실행합니닷')
    await expect(restorePreparationCard).toContainText('확인 문구가 정확히 일치하지 않습니다.')
    await expect(executeButton).toBeDisabled()

    await confirmationTextarea.fill(RESTORE_CONFIRMATION_TEXT)
    await expect(restorePreparationCard).toContainText('확인 문구가 정확히 일치합니다.')
    await expect(executeButton).toBeEnabled()

    await executeButton.click()

    const restoreExecutionNotice = restorePreparationCard.getByRole('status')
    await expect(restoreExecutionNotice).toHaveText('복원 실행이 완료되었습니다.')
    await expect(restoreRow).toContainText('SUCCESS')
    await expect(restoreDetailCard).toContainText('SUCCESS')
  })
})
