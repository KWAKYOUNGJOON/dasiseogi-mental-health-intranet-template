import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const ADMIN_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const CLIENT_LIST_PATH_PATTERN = /\/clients$/
const SIGNUP_REQUESTS_PATH_PATTERN = /\/admin\/signup-requests$/
const USER_MANAGEMENT_PATH_PATTERN = /\/admin\/users$/

const SIGNUP_REQUEST_STATUS_LABELS = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  REJECTED: '반려',
} as const

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function createUniqueLoginId(prefix: string, token: string) {
  return `${prefix}${token}`.slice(0, 20)
}

function getSignupRequestRow(page: Page, loginId: string) {
  return page.locator('tbody tr').filter({ hasText: loginId }).first()
}

function getUserManagementRow(page: Page, loginId: string) {
  return page.locator('tbody tr').filter({ hasText: loginId }).first()
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
}

async function login(page: Page, loginId: string, password: string, expectedName: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
  await expect(page.locator('.topbar-user')).toContainText(expectedName)
}

async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expectLoginScreen(page)
}

async function submitSignupRequest(
  page: Page,
  input: {
    applicantName: string
    loginId: string
    password: string
    requestNote: string
  },
) {
  await page.goto('/signup')

  await expect(page.getByRole('heading', { name: '회원가입 신청' })).toBeVisible()

  await page.getByLabel('이름').fill(input.applicantName)
  await page.getByLabel('아이디').fill(input.loginId)
  await page.locator('#signup-request-password').fill(input.password)
  await page.locator('#signup-request-passwordConfirm').fill(input.password)
  await page.getByLabel('연락처').fill('01012345678')
  await page.getByLabel('직책 또는 역할').selectOption('실무자')
  await page.getByLabel('소속 팀').fill('E2E 검증팀')
  await page.getByLabel('가입 신청 메모').fill(input.requestNote)
  await page.getByRole('button', { name: '가입 신청' }).click()

  await expect(page).toHaveURL(/\/login\?notice=signup-requested$/)
  await expect(page.getByText('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')).toBeVisible()
}

async function openSignupRequestBoard(page: Page) {
  await page.goto('/admin/signup-requests')

  await expect(page).toHaveURL(SIGNUP_REQUESTS_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '회원가입 승인' })).toBeVisible()
}

async function filterSignupRequests(
  page: Page,
  status: keyof typeof SIGNUP_REQUEST_STATUS_LABELS,
) {
  await page.getByLabel('상태').selectOption(status)
  await page.getByLabel('페이지 크기').selectOption('100')
  await page.getByRole('button', { name: '조회', exact: true }).click()

  await expect(page.getByText(`현재 상태 필터: ${SIGNUP_REQUEST_STATUS_LABELS[status]}`)).toBeVisible()
}

async function openSignupProcessDialog(
  page: Page,
  row: Locator,
  applicantName: string,
  loginId: string,
  mode: 'approve' | 'reject',
  processNote: string,
) {
  await row.getByRole('button', { name: mode === 'approve' ? '승인' : '반려' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: mode === 'approve' ? '가입 신청 승인' : '가입 신청 반려' })).toBeVisible()
  await expect(dialog.getByText(`${applicantName} / ${loginId}`)).toBeVisible()

  const processNoteField = dialog.getByLabel('처리 메모')

  await processNoteField.fill(processNote)
  await expect(processNoteField).toHaveValue(processNote)

  await dialog.getByRole('button', { name: mode === 'approve' ? '승인' : '반려' }).click()
}

async function searchUsers(page: Page, keyword: string) {
  await page.getByLabel('검색어').fill(keyword)
  await page.getByLabel('권한 필터').selectOption('')
  await page.getByLabel('상태 필터').selectOption('')
  await page.getByLabel('페이지 크기').selectOption('50')
  await page.getByRole('button', { name: '조회', exact: true }).click()
}

async function openUserManagementBoard(page: Page) {
  await page.goto('/admin/users')

  await expect(page).toHaveURL(USER_MANAGEMENT_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible()
}

async function changeUserRole(
  page: Page,
  input: {
    loginId: string
    userName: string
    nextRole: 'ADMIN' | 'USER'
    expectedSuccessMessage: string
  },
) {
  await searchUsers(page, input.loginId)

  const row = getUserManagementRow(page, input.loginId)

  await expect(row).toContainText(input.userName)
  await row.getByLabel(`${input.userName} 역할 변경 값`).selectOption(input.nextRole)
  await row.getByRole('button', { name: '역할 변경' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '사용자 역할 변경 확인' })).toBeVisible()
  await dialog.getByRole('button', { name: '변경 적용' }).click()

  await expect(page.getByRole('status')).toContainText(input.expectedSuccessMessage)
  await expect(getUserManagementRow(page, input.loginId).getByLabel(`${input.userName} 역할 변경 값`)).toHaveValue(input.nextRole)
}

async function changeUserStatus(
  page: Page,
  input: {
    loginId: string
    userName: string
    nextStatus: 'ACTIVE' | 'INACTIVE'
    expectedSuccessMessage: string
  },
) {
  await searchUsers(page, input.loginId)

  const row = getUserManagementRow(page, input.loginId)

  await expect(row).toContainText(input.userName)
  await row.getByLabel(`${input.userName} 상태 변경 값`).selectOption(input.nextStatus)
  await row.getByRole('button', { name: '상태 변경' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '사용자 상태 변경 확인' })).toBeVisible()
  await dialog.getByRole('button', { name: '변경 적용' }).click()

  await expect(page.getByRole('status')).toContainText(input.expectedSuccessMessage)
  await expect(getUserManagementRow(page, input.loginId).getByLabel(`${input.userName} 상태 변경 값`)).toHaveValue(input.nextStatus)
}

test.describe('실브라우저 관리자 가입 승인 및 사용자 관리 회귀', () => {
  test('관리자가 승인 대기와 사용자 관리 핵심 흐름을 실제 UI에서 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const approvedApplicantName = `PW 승인 사용자 ${token}`
    const rejectedApplicantName = `PW 반려 사용자 ${token}`
    const approvedLoginId = createUniqueLoginId('pwa', token)
    const rejectedLoginId = createUniqueLoginId('pwr', token)
    const approvedPassword = `Pw!${token}`
    const rejectedPassword = `Rw!${token}`
    const approvalRequestNote = `Playwright approval request ${token}`
    const rejectionRequestNote = `Playwright rejection request ${token}`
    const approvalProcessNote = `승인 메모 ${token}`
    const rejectionProcessNote = `반려 메모 ${token}`

    await submitSignupRequest(page, {
      applicantName: approvedApplicantName,
      loginId: approvedLoginId,
      password: approvedPassword,
      requestNote: approvalRequestNote,
    })

    await submitSignupRequest(page, {
      applicantName: rejectedApplicantName,
      loginId: rejectedLoginId,
      password: rejectedPassword,
      requestNote: rejectionRequestNote,
    })

    await login(page, ADMIN_LOGIN_ID, ADMIN_PASSWORD, '관리자A')
    await openSignupRequestBoard(page)

    await filterSignupRequests(page, 'PENDING')

    const approvedPendingRow = getSignupRequestRow(page, approvedLoginId)
    const rejectedPendingRow = getSignupRequestRow(page, rejectedLoginId)

    await expect(approvedPendingRow).toContainText(approvedApplicantName)
    await expect(approvedPendingRow).toContainText('승인 대기')
    await expect(rejectedPendingRow).toContainText(rejectedApplicantName)
    await expect(rejectedPendingRow).toContainText('승인 대기')

    await openSignupProcessDialog(page, approvedPendingRow, approvedApplicantName, approvedLoginId, 'approve', approvalProcessNote)
    await expect(page.getByRole('status')).toContainText('가입 신청을 승인했습니다.')

    await filterSignupRequests(page, 'APPROVED')

    const approvedProcessedRow = getSignupRequestRow(page, approvedLoginId)

    await expect(approvedProcessedRow).toContainText(approvedApplicantName)
    await expect(approvedProcessedRow).toContainText('승인 완료')

    await filterSignupRequests(page, 'PENDING')

    const rejectedStillPendingRow = getSignupRequestRow(page, rejectedLoginId)

    await expect(rejectedStillPendingRow).toContainText(rejectedApplicantName)
    await expect(rejectedStillPendingRow).toContainText('승인 대기')

    await openSignupProcessDialog(page, rejectedStillPendingRow, rejectedApplicantName, rejectedLoginId, 'reject', rejectionProcessNote)
    await expect(page.getByRole('status')).toContainText('가입 신청을 반려했습니다.')

    await filterSignupRequests(page, 'REJECTED')

    const rejectedProcessedRow = getSignupRequestRow(page, rejectedLoginId)

    await expect(rejectedProcessedRow).toContainText(rejectedApplicantName)
    await expect(rejectedProcessedRow).toContainText('반려')

    await logout(page)

    await login(page, approvedLoginId, approvedPassword, approvedApplicantName)
    await logout(page)

    await page.goto('/login')
    await expectLoginScreen(page)
    await page.getByLabel('아이디').fill(rejectedLoginId)
    await page.getByLabel('비밀번호').fill(rejectedPassword)
    await page.getByRole('button', { name: '로그인' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('alert')).toContainText('반려된 계정입니다.')

    await login(page, ADMIN_LOGIN_ID, ADMIN_PASSWORD, '관리자A')
    await openUserManagementBoard(page)

    await changeUserRole(page, {
      loginId: approvedLoginId,
      userName: approvedApplicantName,
      nextRole: 'ADMIN',
      expectedSuccessMessage: `${approvedApplicantName} 사용자의 역할을 관리자로 변경했습니다.`,
    })

    await changeUserStatus(page, {
      loginId: approvedLoginId,
      userName: approvedApplicantName,
      nextStatus: 'INACTIVE',
      expectedSuccessMessage: `${approvedApplicantName} 사용자의 상태를 비활성으로 변경했습니다.`,
    })

    await searchUsers(page, ADMIN_LOGIN_ID)

    const adminRow = getUserManagementRow(page, ADMIN_LOGIN_ID)

    await expect(adminRow).toContainText('관리자A')
    await adminRow.getByLabel('관리자A 상태 변경 값').selectOption('INACTIVE')
    await adminRow.getByRole('button', { name: '상태 변경' }).click()

    const dialog = page.getByRole('dialog')

    await expect(dialog.getByRole('heading', { name: '사용자 상태 변경 확인' })).toBeVisible()
    await dialog.getByRole('button', { name: '변경 적용' }).click()
    await expect(dialog.getByRole('alert')).toContainText(/마지막 활성 관리자.*(변경할 수 없습니다|비활성화할 수 없습니다)/)
    await dialog.getByRole('button', { name: '취소' }).click()
  })
})
