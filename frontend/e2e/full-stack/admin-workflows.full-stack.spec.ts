import { expect, test, type Page } from '@playwright/test'

function createUniqueToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12)
}

function createUniqueLoginId(token: string) {
  return `pw${token}`.slice(0, 20)
}

async function login(page: Page, loginId: string, password: string) {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: '로그아웃' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: '다시서기 정신건강 평가관리 시스템' })).toBeVisible()
}

async function findRowAcrossPages(page: Page, text: string) {
  const nextButton = page.getByRole('button', { name: '다음' })

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const row = page.locator('tbody tr').filter({ hasText: text }).first()

    if ((await row.count()) > 0) {
      return row
    }

    if (await nextButton.isDisabled()) {
      break
    }

    await nextButton.click()
  }

  throw new Error(`Could not find a table row containing "${text}".`)
}

async function approveSignupRequest(page: Page, loginId: string, processNote: string) {
  await page.getByRole('link', { name: '승인 대기' }).click()

  await expect(page).toHaveURL(/\/admin\/signup-requests$/)
  await expect(page.getByRole('heading', { name: '회원가입 승인' })).toBeVisible()

  await page.getByLabel('페이지 크기').selectOption('50')
  await page.getByRole('button', { name: '조회', exact: true }).click()

  await expect(page.locator('tbody')).toContainText(loginId)
  const row = page.locator('tbody tr').filter({ hasText: loginId }).first()
  await expect(row).toContainText(loginId)
  await row.getByRole('button', { name: '승인' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '가입 신청 승인' })).toBeVisible()
  await dialog.getByLabel('처리 메모').fill(processNote)
  await dialog.getByRole('button', { name: '승인' }).click()

  await expect(page.getByRole('status')).toContainText('가입 신청을 승인했습니다.')
}

async function rejectSignupRequest(page: Page, loginId: string, processNote: string) {
  await page.getByRole('link', { name: '승인 대기' }).click()

  await expect(page).toHaveURL(/\/admin\/signup-requests$/)
  await expect(page.getByRole('heading', { name: '회원가입 승인' })).toBeVisible()

  await page.getByLabel('페이지 크기').selectOption('50')
  await page.getByRole('button', { name: '조회', exact: true }).click()

  await expect(page.locator('tbody')).toContainText(loginId)
  const row = page.locator('tbody tr').filter({ hasText: loginId }).first()
  await expect(row).toContainText(loginId)
  await row.getByRole('button', { name: '반려' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '가입 신청 반려' })).toBeVisible()
  await dialog.getByLabel('처리 메모').fill(processNote)
  await dialog.getByRole('button', { name: '반려' }).click()

  await expect(page.getByRole('status')).toContainText('가입 신청을 반려했습니다.')
}

async function changeUserStatus(page: Page, keyword: string, applicantName: string, status: 'ACTIVE' | 'INACTIVE') {
  await page.getByRole('link', { name: '사용자 관리' }).click()

  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible()

  await page.getByLabel('검색어').fill(keyword)
  await page.getByLabel('페이지 크기').selectOption('50')
  await page.getByRole('button', { name: '조회', exact: true }).click()

  await expect(page.locator('tbody')).toContainText(keyword)
  const row = page.locator('tbody tr').filter({ hasText: keyword }).first()
  await row.getByLabel(`${applicantName} 상태 변경 값`).selectOption(status)
  await row.getByRole('button', { name: '상태 변경' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '사용자 상태 변경 확인' })).toBeVisible()
  await dialog.getByRole('button', { name: '변경 적용' }).click()

  const expectedNotice =
    status === 'ACTIVE'
      ? `${applicantName} 사용자의 상태를 활성으로 변경했습니다.`
      : `${applicantName} 사용자의 상태를 비활성으로 변경했습니다.`

  await expect(page.getByRole('status')).toContainText(expectedNotice)
}

async function expectClientInList(page: Page, clientName: string) {
  await page.getByRole('link', { name: '대상자' }).click()

  await expect(page).toHaveURL(/\/clients$/)
  await page.getByPlaceholder('이름 검색').fill(clientName)
  await page.getByRole('button', { name: '검색' }).click()

  await expect(page.getByRole('cell', { name: clientName })).toBeVisible()
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

async function answerCurrentScaleWithFirstOptions(page: Page) {
  const fieldsets = page.locator('fieldset.assessment-question-card')
  const questionCount = await fieldsets.count()

  for (let index = 0; index < questionCount; index += 1) {
    await fieldsets.nth(index).locator('label.assessment-option').first().click()
  }
}

async function submitSignupRequest(page: Page, applicantName: string, loginId: string, password: string, memo: string) {
  await page.goto('/signup')

  await expect(page.getByRole('heading', { name: '회원가입 신청' })).toBeVisible()

  await page.getByLabel('이름').fill(applicantName)
  await page.getByLabel('아이디').fill(loginId)
  await page.locator('#signup-request-password').fill(password)
  await page.locator('#signup-request-passwordConfirm').fill(password)
  await page.getByLabel('연락처').fill('01012345678')
  await page.getByLabel('직책 또는 역할').selectOption('실무자')
  await page.getByLabel('소속 팀').fill('E2E 검증팀')
  await page.getByLabel('가입 신청 메모').fill(memo)
  await page.getByRole('button', { name: '가입 신청' }).click()

  await expect(page).toHaveURL(/\/login\?notice=signup-requested$/)
  await expect(page.getByText('가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')).toBeVisible()
}

async function expectCsvDownload(
  page: Page,
  buttonName: '요약 CSV' | '척도비교 CSV' | '경고목록 CSV',
  exportType: 'SUMMARY' | 'SCALE_COMPARE' | 'ALERT_LIST',
  filenamePrefix: string,
) {
  const responsePromise = page.waitForResponse((response) => {
    try {
      const url = new URL(response.url())
      return url.pathname.endsWith('/api/v1/statistics/export') && url.searchParams.get('type') === exportType
    } catch {
      return false
    }
  })
  const downloadPromise = page.waitForEvent('download')

  await page.getByRole('button', { name: buttonName, exact: true }).click()

  const [response, download] = await Promise.all([responsePromise, downloadPromise])
  const contentType = response.headers()['content-type'] ?? ''
  const contentDisposition = response.headers()['content-disposition'] ?? ''
  const filename = download.suggestedFilename()

  expect(response.ok()).toBeTruthy()
  expect(contentType).toContain('text/csv')
  expect(contentDisposition).toContain('attachment;')
  expect(contentDisposition).toContain(filenamePrefix)
  expect(filename).toContain(filenamePrefix)
  expect(filename).toMatch(/\.csv$/)
}

async function expectPermissionRedirectToClients(page: Page, path: string) {
  await page.goto(path)
  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByRole('heading', { name: '대상자 목록' })).toBeVisible()
}

test('guest signup request can be approved by admin and used to sign in', async ({ page }) => {
  const token = createUniqueToken()
  const loginId = createUniqueLoginId(token)
  const password = `Pw!${token}`
  const applicantName = `PW 승인테스트 ${token}`

  await submitSignupRequest(page, applicantName, loginId, password, `Playwright full-stack approval flow ${token}`)

  await login(page, 'admina', 'Test1234!')
  await approveSignupRequest(page, loginId, `승인 완료 ${token}`)
  await logout(page)

  await login(page, loginId, password)
  await expect(page.locator('.topbar-user').getByText(applicantName)).toBeVisible()
  await expect(page.getByText('일반 사용자')).toBeVisible()
  await logout(page)

  await login(page, 'admina', 'Test1234!')
  await changeUserStatus(page, loginId, applicantName, 'INACTIVE')
})

test('admin can create a client and load the statistics page', async ({ page }) => {
  const token = createUniqueToken()
  const clientName = `PWClient${token}`

  await login(page, 'admina', 'Test1234!')

  await page.goto('/clients/new')

  await expect(page.getByRole('heading', { name: '대상자 등록' })).toBeVisible()

  await page.getByLabel('이름').fill(clientName)
  await page.getByLabel('생년월일').fill('19900102')
  await page.getByLabel('연락처').fill('01022223333')
  await page.getByRole('button', { name: '중복 확인' }).click()

  await expect(page.getByText('중복 후보가 없습니다.')).toBeVisible()

  await page.getByRole('button', { name: '저장' }).click()

  await expect(page).toHaveURL(/\/clients\/\d+$/)
  const clientDetailUrl = page.url()
  await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
  await expect(page.getByText('1990-01-02')).toBeVisible()
  await expectClientInList(page, clientName)

  await page.getByRole('link', { name: '통계' }).click()

  await expect(page).toHaveURL(/\/statistics$/)
  await expect(page.getByRole('heading', { name: '통계' })).toBeVisible()
  await expect(page.getByRole('button', { name: '요약 CSV' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '담당자별 세션 수' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '경고 기록' })).toBeVisible()

  const alertTypeSelect = page.getByLabel('경고 유형')
  await alertTypeSelect.selectOption('CAUTION')
  const selectedAlertTypeLabel = ((await alertTypeSelect.locator('option:checked').textContent()) ?? '').trim()
  await page.getByRole('button', { name: '조회' }).click()

  await expect(page.getByText(`필터: 전체 척도 / ${selectedAlertTypeLabel}`)).toBeVisible()

  await page.goto(clientDetailUrl)
  await expect(page.getByRole('heading', { name: `${clientName} 상세` })).toBeVisible()
  await markCurrentClientMisregistered(page, `Playwright cleanup ${token}`)
})

test('admin can create an assessment session and mark it as misentered', async ({ page }) => {
  const reason = `Playwright misentered cleanup ${createUniqueToken()}`

  await login(page, 'admina', 'Test1234!')

  await page.goto('/clients')
  await page.getByPlaceholder('이름 검색').fill('김대상')
  await page.getByRole('button', { name: '검색' }).click()
  await page.getByRole('row', { name: /김대상/ }).getByRole('link', { name: '상세보기' }).click()

  await expect(page.getByRole('heading', { name: '김대상 상세' })).toBeVisible()
  await page.getByRole('link', { name: '검사 시작' }).click()

  await expect(page).toHaveURL(/\/assessments\/start\/\d+$/)
  await expect(page.getByRole('heading', { name: '척도 선택' })).toBeVisible()

  await page.getByRole('checkbox', { name: /PHQ-9/ }).check()
  await page.getByRole('button', { name: '검사 시작' }).click()

  await expect(page.getByRole('heading', { name: 'PHQ-9 입력' })).toBeVisible()
  await answerCurrentScaleWithFirstOptions(page)
  await page.getByRole('button', { name: '다음' }).click()

  await expect(page.getByRole('heading', { name: '세션 요약' })).toBeVisible()
  await page.getByRole('textbox', { name: /세션 메모/ }).fill('Playwright assessment session flow')
  await page.getByRole('button', { name: '세션 저장' }).click()

  await expect(page).toHaveURL(/\/assessments\/sessions\/\d+/)
  await expect(page.getByRole('heading', { name: '세션 상세', exact: true })).toBeVisible()
  await expect(page.getByText('Playwright assessment session flow')).toBeVisible()
  await expect(page.getByText('PHQ-9')).toBeVisible()
  await expect(page.getByRole('button', { name: '오입력 처리' })).toBeVisible()

  await page.getByRole('button', { name: '오입력 처리' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '세션 오입력 처리' })).toBeVisible()
  await dialog.getByRole('textbox').fill(reason)
  await dialog.getByRole('button', { name: '오입력 처리' }).click()

  await expect(page.getByText('오입력 처리되었습니다.')).toBeVisible()
  await expect(page.getByText('오입력', { exact: true })).toBeVisible()
  await expect(page.getByText(reason)).toBeVisible()
})

test('admin can run a manual backup from the backup management page', async ({ page }) => {
  const token = createUniqueToken()

  await login(page, 'admina', 'Test1234!')

  await page.getByRole('link', { name: '백업 관리' }).click()

  await expect(page).toHaveURL(/\/admin\/backups$/)
  await expect(page.getByRole('heading', { name: '백업 관리' })).toBeVisible()

  await page.getByRole('button', { name: '수동 백업 실행' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: '수동 백업 실행 확인' })).toBeVisible()
  await dialog.getByLabel('실행 사유').fill(`Playwright manual backup ${token}`)
  await dialog.getByRole('button', { name: '백업 실행' }).click()

  await expect(page.getByRole('status')).toContainText('수동 백업을 실행했습니다.')
  await expect(page.getByRole('cell', { name: 'MANUAL' }).first()).toBeVisible()
  await expect(page.getByText(/backup-.*(snapshot|db-dump)/i).first()).toBeVisible()
})

test('guest signup request can be rejected and then cannot sign in', async ({ page }) => {
  const token = createUniqueToken()
  const loginId = createUniqueLoginId(token)
  const password = `Pw!${token}`
  const applicantName = `PW 반려테스트 ${token}`

  await submitSignupRequest(page, applicantName, loginId, password, `Playwright reject flow ${token}`)

  await login(page, 'admina', 'Test1234!')
  await rejectSignupRequest(page, loginId, `반려 처리 ${token}`)
  await logout(page)

  await page.getByLabel('아이디').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toContainText('반려된 계정입니다.')
})

test('regular user is blocked from admin surfaces and does not see statistics export controls', async ({ page }) => {
  await login(page, 'usera', 'Test1234!')

  await expect(page.getByRole('link', { name: '승인 대기' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '사용자 관리' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '백업 관리' })).toHaveCount(0)

  await expectPermissionRedirectToClients(page, '/admin/signup-requests')
  await expectPermissionRedirectToClients(page, '/admin/users')
  await expectPermissionRedirectToClients(page, '/admin/backups')

  await page.goto('/statistics')
  await expect(page).toHaveURL(/\/statistics$/)
  await expect(page.getByRole('heading', { name: '통계' })).toBeVisible()
  await expect(page.getByRole('button', { name: '요약 CSV' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '척도비교 CSV' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '경고목록 CSV' })).toHaveCount(0)
})

test('admin can download all statistics CSV exports', async ({ page }) => {
  await login(page, 'admina', 'Test1234!')

  await page.goto('/statistics')
  await expect(page).toHaveURL(/\/statistics$/)
  await expect(page.getByRole('heading', { name: '통계' })).toBeVisible()

  await expectCsvDownload(page, '요약 CSV', 'SUMMARY', 'statistics-summary')
  await expectCsvDownload(page, '척도비교 CSV', 'SCALE_COMPARE', 'statistics-scale-compare')
  await expectCsvDownload(page, '경고목록 CSV', 'ALERT_LIST', 'statistics-alert-list')
})
