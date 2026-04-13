import { expect, test, type Locator, type Page } from '@playwright/test'

const ADMIN_LOGIN_ID = 'admina'
const USER_LOGIN_ID = 'usera'
const DEFAULT_PASSWORD = 'Test1234!'
const LOGIN_HEADING = '다시서기 정신건강 평가관리 시스템'
const LOGIN_PATH_PATTERN = /\/login(?:\?.*)?$/
const CLIENT_LIST_PATH_PATTERN = /\/clients$/
const ADMIN_USERS_PATH_PATTERN = /\/admin\/users$/
const SIGNUP_REQUESTS_PATH_PATTERN = /\/admin\/signup-requests$/
const ASSESSMENT_RECORDS_PATH_PATTERN = /\/assessment-records(?:\?.*)?$/

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function createUniqueLoginId(token: string) {
  return `pw${token}`.slice(0, 20)
}

function getClientIdFromUrl(url: string) {
  const clientId = Number(new URL(url).pathname.split('/').pop())

  if (!Number.isInteger(clientId) || clientId <= 0) {
    throw new Error(`Could not parse a client id from URL: ${url}`)
  }

  return clientId
}

function getSessionIdFromUrl(url: string) {
  const matchedSessionId = new URL(url).pathname.match(/\/assessments\/sessions\/(\d+)$/)?.[1]
  const sessionId = Number(matchedSessionId)

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error(`Could not parse a session id from URL: ${url}`)
  }

  return sessionId
}

async function expectLoginScreen(page: Page) {
  await expect(page).toHaveURL(LOGIN_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: LOGIN_HEADING })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
}

async function expectGuestRedirectToLogin(page: Page, path: string) {
  await page.goto(path)
  await expectLoginScreen(page)
}

async function login(page: Page, loginId: string, password: string, expectedName?: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()

  if (expectedName) {
    await expect(page.locator('.topbar-user')).toContainText(expectedName)
  }
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
    phone: string
    teamName: string
    requestMemo: string
  },
) {
  await page.goto('/signup')

  await expect(page.getByRole('heading', { name: '회원가입 신청' })).toBeVisible()

  const positionSelect = page.getByLabel('직책 또는 역할')

  await expect(positionSelect).toBeEnabled()
  await expect(positionSelect.locator('option', { hasText: '실무자' })).toHaveCount(1)

  await page.getByLabel('이름').fill(input.applicantName)
  await page.getByLabel('아이디').fill(input.loginId)
  await page.locator('#signup-request-password').fill(input.password)
  await page.locator('#signup-request-passwordConfirm').fill(input.password)
  await page.getByLabel('연락처').fill(input.phone)
  await positionSelect.selectOption('실무자')
  await page.getByLabel('소속 팀').fill(input.teamName)
  await page.getByLabel('가입 신청 메모').fill(input.requestMemo)
  await page.getByRole('button', { name: '가입 신청' }).click()

  await expect(page).toHaveURL(/\/login\?notice=signup-requested$/)
  await expect(page.getByText('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')).toBeVisible()
}

async function attemptLoginExpectError(page: Page, loginId: string, password: string, message: string) {
  await page.goto('/login')
  await expectLoginScreen(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(LOGIN_PATH_PATTERN)
  await expect(page.getByRole('alert')).toContainText(message)
}

async function approveSignupRequest(page: Page, loginId: string, processNote: string) {
  await page.getByRole('link', { name: '승인 대기' }).click()

  await expect(page).toHaveURL(SIGNUP_REQUESTS_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '회원가입 승인' })).toBeVisible()

  await page.getByLabel('상태').selectOption('PENDING')
  await page.getByLabel('페이지 크기').selectOption('50')
  await page.getByRole('button', { name: '조회', exact: true }).click()

  const row = page.locator('tbody tr').filter({ hasText: loginId }).first()

  await expect(row).toContainText(loginId)
  await row.getByRole('button', { name: '승인' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '가입 신청 승인' })).toBeVisible()
  await dialog.getByLabel('처리 메모').fill(processNote)
  await dialog.getByRole('button', { name: '승인' }).click()

  await expect(page.getByRole('status')).toContainText('가입 신청을 승인했습니다.')
}

async function expectAdminSurfaceHiddenForRegularUser(page: Page) {
  await expect(page.getByRole('link', { name: '승인 대기' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '사용자 관리' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '로그 확인' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '백업 관리' })).toHaveCount(0)

  await page.goto('/admin/users')
  await expect(page).toHaveURL(CLIENT_LIST_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
}

async function expectAdminSurfaceVisible(page: Page) {
  await expect(page.getByRole('link', { name: '승인 대기' })).toBeVisible()
  await expect(page.getByRole('link', { name: '사용자 관리' })).toBeVisible()
  await page.getByRole('link', { name: '사용자 관리' }).click()

  await expect(page).toHaveURL(ADMIN_USERS_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible()
}

async function createClientThroughUi(
  page: Page,
  input: {
    name: string
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
    birthDate: string
    phone: string
  },
) {
  await page.goto('/clients/new')

  await expect(page.getByRole('heading', { name: '대상자 등록' })).toBeVisible()

  await page.getByLabel('이름').fill(input.name)
  await page.getByLabel('성별').selectOption(input.gender)
  await page.getByLabel('생년월일').fill(input.birthDate)
  await page.getByLabel('연락처').fill(input.phone)
  await page.getByRole('button', { name: '중복 확인' }).click()
  await expect(page.getByText('중복 후보가 없습니다.')).toBeVisible()

  await page.getByRole('button', { name: '저장' }).click()

  await expect(page).toHaveURL(/\/clients\/\d+$/)
  await expect(page.getByRole('heading', { name: `${input.name} 상세` })).toBeVisible()

  return {
    clientId: getClientIdFromUrl(page.url()),
    detailUrl: page.url(),
  }
}

async function setCheckboxState(locator: Locator, checked: boolean) {
  if ((await locator.isChecked()) === checked) {
    return
  }

  await locator.click()
}

async function searchClients(page: Page, name: string, includeMisregistered: boolean) {
  await page.goto('/clients')
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()

  await page.getByPlaceholder('이름 검색').fill(name)
  await setCheckboxState(page.getByLabel('오등록 포함'), includeMisregistered)
  await page.getByRole('button', { name: '검색' }).click()
}

async function openClientDetailFromList(page: Page, clientName: string) {
  const row = page.locator('tbody tr').filter({ hasText: clientName }).first()

  await expect(row).toContainText(clientName)
  await row.getByRole('link', { name: '상세보기' }).click()
  await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
}

function getSessionDetailField(page: Page, label: string) {
  return page.locator('.card.grid-2 .field').filter({ hasText: label }).locator('strong').first()
}

async function markCurrentClientMisregistered(page: Page, reason: string) {
  await page.getByRole('button', { name: '오등록 처리' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '대상자 오등록 처리' })).toBeVisible()
  await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: '오등록 처리' }).click()

  await expect(page.getByText('오등록 처리되었습니다.')).toBeVisible()
  await expect(page.getByText('오등록', { exact: true })).toBeVisible()
  await expect(page.getByText(reason)).toBeVisible()
}

async function searchAssessmentRecords(
  page: Page,
  input: {
    clientName: string
    includeMisentered: boolean
  },
) {
  await page.goto('/assessment-records')
  await expect(page).toHaveURL(ASSESSMENT_RECORDS_PATH_PATTERN)
  await expect(page.getByRole('heading', { name: '검사기록 목록' })).toBeVisible()

  await page.getByPlaceholder('대상자명').fill(input.clientName)
  await setCheckboxState(page.getByLabel('오입력 포함'), input.includeMisentered)
  await page.getByRole('button', { name: '조회' }).click()
}

async function answerQuestion(page: Page, questionIndex: number, optionIndex: number) {
  const question = page.locator('fieldset.assessment-question-card').nth(questionIndex)

  await question.locator('label.assessment-option').nth(optionIndex).click()
}

async function createPhq9SessionThroughUi(
  page: Page,
  input: {
    clientName: string
    memo: string
  },
) {
  await searchClients(page, input.clientName, false)
  await openClientDetailFromList(page, input.clientName)

  await page.getByRole('link', { name: '검사 시작' }).click()

  await expect(page).toHaveURL(/\/assessments\/start\/\d+(?:\/scales)?$/)
  await expect(page.getByRole('heading', { name: '척도 선택' })).toBeVisible()

  await page.getByRole('checkbox', { name: /PHQ-9/ }).check()
  await page.getByRole('button', { name: '검사 시작' }).click()

  await expect(page.getByRole('heading', { name: 'PHQ-9 입력' })).toBeVisible()

  for (let questionIndex = 0; questionIndex < 8; questionIndex += 1) {
    await answerQuestion(page, questionIndex, 0)
  }
  await answerQuestion(page, 8, 1)

  await expect(page.getByText('응답 완료 9 / 9')).toBeVisible()
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '세션 요약' })).toBeVisible()
  await expect(page.locator('tbody tr').filter({ hasText: 'PHQ-9' }).first()).toBeVisible()

  await page.getByLabel('세션 메모').fill(input.memo)
  await page.getByRole('button', { name: '세션 저장' }).click()

  await expect(page).toHaveURL(/\/assessments\/sessions\/\d+/)
  await expect(page.getByRole('heading', { name: '세션 상세' })).toBeVisible()

  const detailUrl = page.url()

  const sessionNo = (await page.locator('.card.grid-2 .field').filter({ hasText: '세션번호' }).locator('strong').first().textContent())?.trim()

  if (!sessionNo) {
    throw new Error('Could not read the saved session number from the session detail page.')
  }

  return {
    detailUrl,
    sessionId: getSessionIdFromUrl(detailUrl),
    sessionNo,
  }
}

async function markCurrentSessionMisentered(page: Page, reason: string) {
  await page.getByRole('button', { name: '오입력 처리' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog.getByRole('heading', { name: '세션 오입력 처리' })).toBeVisible()
  await expect(dialog.getByText('세션과 하위 결과는 유지한 채 상태만 MISENTERED로 변경합니다.')).toBeVisible()
  await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: '오입력 처리' }).click()
}

test.describe('실브라우저 핵심 업무 흐름', () => {
  test('비로그인 사용자는 보호 라우트 접근 시 로그인 화면으로 이동한다', async ({ page }) => {
    await expectGuestRedirectToLogin(page, '/clients/new')
    await expectGuestRedirectToLogin(page, '/admin/users')
  })

  test('회원가입 신청부터 관리자 승인과 권한 분기까지 실제 UI로 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const loginId = createUniqueLoginId(token)
    const applicantName = `PW 승인 사용자 ${token}`
    const password = `Pw!${token}`

    await submitSignupRequest(page, {
      applicantName,
      loginId,
      password,
      phone: '01012345678',
      teamName: 'Playwright 승인팀',
      requestMemo: `실브라우저 승인 검증 ${token}`,
    })

    await attemptLoginExpectError(page, loginId, password, '승인 대기 중인 계정입니다.')

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')
    await approveSignupRequest(page, loginId, `승인 완료 ${token}`)
    await expectAdminSurfaceVisible(page)
    await logout(page)

    await login(page, loginId, password, applicantName)
    await expect(page.locator('.topbar-user')).toContainText('일반 사용자')
    await expectAdminSurfaceHiddenForRegularUser(page)
  })

  test('관리자는 대상자 오등록 처리와 검사 저장 후 세션 상세를 실제 UI로 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const misregisteredClientName = `PW 오등록 대상자 ${token}`
    const assessmentClientName = `PW 검사 대상자 ${token}`
    const misregisteredReason = `Playwright 오등록 처리 ${token}`
    const sessionMemo = `Playwright 세션 저장 ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    const misregisteredClient = await createClientThroughUi(page, {
      name: misregisteredClientName,
      gender: 'FEMALE',
      birthDate: '19900102',
      phone: '01011112222',
    })

    await markCurrentClientMisregistered(page, misregisteredReason)

    await searchClients(page, misregisteredClientName, false)
    await expect(page.getByText('검색 조건에 맞는 대상자가 없습니다.')).toBeVisible()

    await searchClients(page, misregisteredClientName, true)
    const misregisteredRow = page.locator('tbody tr').filter({ hasText: misregisteredClientName }).first()
    await expect(misregisteredRow).toContainText('오등록')
    await misregisteredRow.getByRole('link', { name: '상세보기' }).click()
    await expect(page.getByRole('heading', { name: `${misregisteredClientName} 상세` })).toBeVisible()
    await expect(page.getByText(misregisteredReason)).toBeVisible()
    await logout(page)

    await login(page, USER_LOGIN_ID, DEFAULT_PASSWORD, '사용자A')
    await searchClients(page, misregisteredClientName, true)
    await expect(page.getByText('검색 조건에 맞는 대상자가 없습니다.')).toBeVisible()

    await page.goto(`/clients/${misregisteredClient.clientId}`)
    await expect(page.getByText('해당 대상자를 조회할 권한이 없습니다.')).toBeVisible()
    await logout(page)

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    await createClientThroughUi(page, {
      name: assessmentClientName,
      gender: 'MALE',
      birthDate: '19890517',
      phone: '01033334444',
    })

    const { sessionNo } = await createPhq9SessionThroughUi(page, {
      clientName: assessmentClientName,
      memo: sessionMemo,
    })

    const sessionStatus = page.locator('.card.grid-2 .field').filter({ hasText: '상태' }).locator('strong').first()
    const sessionMemoField = page.locator('.card.grid-2 .field').filter({ hasText: '세션 메모' }).locator('strong').first()

    await expect(page.getByText('세션이 저장되었습니다.')).toBeVisible()
    await expect(sessionMemoField).toHaveText(sessionMemo)
    await expect(sessionStatus).toHaveText('완료')
    await expect(page.locator('[data-testid="session-scale-PHQ9"]')).toContainText('총점 1 / 최소')
    await expect(page.getByRole('heading', { name: '경고' })).toBeVisible()
    await expect(page.getByText('[PHQ-9] 9번 문항 응답으로 인해 추가 안전 확인이 필요합니다.')).toBeVisible()

    await page.goto('/assessment-records')
    await expect(page).toHaveURL(ASSESSMENT_RECORDS_PATH_PATTERN)
    await expect(page.getByRole('heading', { name: '검사기록 목록' })).toBeVisible()

    await page.getByPlaceholder('대상자명').fill(assessmentClientName)
    await page.getByRole('button', { name: '조회' }).click()

    const recordRow = page.locator('tbody tr').filter({ hasText: assessmentClientName }).first()
    await expect(recordRow).toContainText('PHQ-9')
    await expect(recordRow).toContainText('1')
    await expect(recordRow).toContainText('최소')
    await expect(recordRow).toContainText('있음')
    await expect(recordRow).toContainText('정상')

    await searchClients(page, assessmentClientName, false)
    await openClientDetailFromList(page, assessmentClientName)
    await expect(page.getByText('최근 검사 세션')).toBeVisible()

    const recentSessionRow = page.locator('tbody tr').filter({ hasText: sessionNo }).first()
    await expect(recentSessionRow).toContainText('있음')
    await expect(recentSessionRow.getByRole('link', { name: '세션 상세' })).toBeVisible()
  })

  test('관리자는 저장된 검사 세션을 UI에서 오입력 처리하고 상태 반영과 접근 정책을 검증한다', async ({ page }) => {
    test.slow()

    const token = createUniqueToken()
    const clientName = `PW 세션 오입력 ${token}`
    const sessionMemo = `Playwright 세션 오입력 검증 ${token}`
    const misenteredReason = `Playwright 세션 오입력 사유 ${token}`

    await login(page, ADMIN_LOGIN_ID, DEFAULT_PASSWORD, '관리자A')

    const client = await createClientThroughUi(page, {
      name: clientName,
      gender: 'FEMALE',
      birthDate: '19940315',
      phone: '01045678901',
    })

    const { detailUrl, sessionId, sessionNo } = await createPhq9SessionThroughUi(page, {
      clientName,
      memo: sessionMemo,
    })

    await expect(page.getByText('세션이 저장되었습니다.')).toBeVisible()
    await expect(getSessionDetailField(page, '세션번호')).toHaveText(sessionNo)
    await expect(getSessionDetailField(page, '상태')).toHaveText('완료')
    await expect(getSessionDetailField(page, '세션 메모')).toHaveText(sessionMemo)
    await expect(page.locator('[data-testid="session-scale-PHQ9"]')).toContainText('총점 1 / 최소')
    await expect(page.getByText('[PHQ-9] 9번 문항 응답으로 인해 추가 안전 확인이 필요합니다.')).toBeVisible()

    await searchAssessmentRecords(page, { clientName, includeMisentered: false })

    const completedRecordRow = page.locator('tbody tr').filter({ hasText: clientName }).first()
    const completedRecordDetailLink = completedRecordRow.getByRole('link', { name: '상세 보기' })

    await expect(completedRecordRow).toContainText('PHQ-9')
    await expect(completedRecordRow).toContainText('최소')
    await expect(completedRecordRow.locator('[data-status="COMPLETED"]')).toHaveText('정상')
    await expect(
      completedRecordDetailLink,
    ).toHaveAttribute('href', new RegExp(`/assessments/sessions/${sessionId}\\?highlightScaleCode=PHQ9`))

    await page.goto(client.detailUrl)
    await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
    await expect(page.getByText('최근 검사 세션')).toBeVisible()

    const recentSessionRow = page.locator('tbody tr').filter({ hasText: sessionNo }).first()
    const recentSessionDetailLink = recentSessionRow.getByRole('link', { name: '세션 상세' })

    await expect(recentSessionRow).toContainText('있음')
    await expect(recentSessionDetailLink).toHaveAttribute('href', `/assessments/sessions/${sessionId}`)
    await recentSessionDetailLink.click()

    await expect(page).toHaveURL(new RegExp(`/assessments/sessions/${sessionId}$`))
    await expect(page.url()).toBe(detailUrl)
    await expect(getSessionDetailField(page, '세션번호')).toHaveText(sessionNo)

    await markCurrentSessionMisentered(page, misenteredReason)

    await expect(page.getByText('오입력 처리되었습니다.')).toBeVisible()
    await expect(getSessionDetailField(page, '세션번호')).toHaveText(sessionNo)
    await expect(getSessionDetailField(page, '상태')).toHaveText('오입력')
    await expect(getSessionDetailField(page, '세션 메모')).toHaveText(sessionMemo)
    await expect(getSessionDetailField(page, '오입력 처리 시각')).not.toHaveText('-')
    await expect(getSessionDetailField(page, '처리자')).toHaveText('관리자A')
    await expect(getSessionDetailField(page, '사유')).toHaveText(misenteredReason)
    await expect(page.locator('[data-testid="session-scale-PHQ9"]')).toContainText('총점 1 / 최소')
    await expect(page.getByText('[PHQ-9] 9번 문항 응답으로 인해 추가 안전 확인이 필요합니다.')).toBeVisible()
    await expect(page.getByRole('button', { name: '오입력 처리' })).toHaveCount(0)

    await searchAssessmentRecords(page, { clientName, includeMisentered: false })
    await expect(page.getByText('조회된 검사기록이 없습니다.')).toBeVisible()

    await searchAssessmentRecords(page, { clientName, includeMisentered: true })

    const misenteredRecordRow = page.locator('tbody tr').filter({ hasText: clientName }).first()
    const misenteredRecordDetailLink = misenteredRecordRow.getByRole('link', { name: '상세 보기' })

    await expect(misenteredRecordRow).toContainText('PHQ-9')
    await expect(misenteredRecordRow.locator('[data-status="MISENTERED"]')).toHaveText('오입력')
    await expect(
      misenteredRecordDetailLink,
    ).toHaveAttribute('href', new RegExp(`/assessments/sessions/${sessionId}\\?highlightScaleCode=PHQ9`))
    await misenteredRecordDetailLink.click()

    await expect(page).toHaveURL(new RegExp(`/assessments/sessions/${sessionId}\\?highlightScaleCode=PHQ9`))
    await expect(getSessionDetailField(page, '세션번호')).toHaveText(sessionNo)
    await expect(getSessionDetailField(page, '상태')).toHaveText('오입력')
    await expect(getSessionDetailField(page, '사유')).toHaveText(misenteredReason)
    await expect(page.getByTestId('session-scale-PHQ9')).toHaveAttribute('data-highlighted', 'true')

    await page.goto(client.detailUrl)
    await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
    await expect(page.getByText('아직 저장된 검사 세션이 없습니다.')).toBeVisible()

    await logout(page)

    await login(page, USER_LOGIN_ID, DEFAULT_PASSWORD, '사용자A')
    await searchAssessmentRecords(page, { clientName, includeMisentered: true })
    await expect(page.getByText('조회된 검사기록이 없습니다.')).toBeVisible()

    await page.goto(`/assessments/sessions/${sessionId}`)
    await expect(page.getByText('세션 상세를 볼 수 없습니다.')).toBeVisible()
    await expect(page.getByText('해당 세션을 조회할 권한이 없습니다.')).toBeVisible()
  })
})
