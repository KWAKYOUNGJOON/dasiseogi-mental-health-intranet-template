import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchClients, type ClientListPage as ClientListPageResponse } from '../src/features/clients/api/clientApi'
import { ClientListPage } from '../src/pages/clients/ClientListPage'

vi.mock('../src/features/clients/api/clientApi', () => ({
  fetchClients: vi.fn(),
}))

const mockedFetchClients = vi.mocked(fetchClients)

function createClientListPage(overrides?: Partial<ClientListPageResponse>): ClientListPageResponse {
  return {
    items: [
      {
        id: 11,
        clientNo: 'CL-00011',
        name: '김대상',
        birthDate: '2026-03-02',
        gender: 'MALE',
        primaryWorkerName: '김담당',
        latestSessionDate: '2026-03-31',
        status: 'ACTIVE',
      },
    ],
    page: 1,
    size: 20,
    totalItems: 1,
    totalPages: 1,
    ...overrides,
  }
}

function createEmptyClientListPage(overrides?: Partial<ClientListPageResponse>): ClientListPageResponse {
  return {
    items: [],
    page: 1,
    size: 20,
    totalItems: 0,
    totalPages: 0,
    ...overrides,
  }
}

function renderClientListPage() {
  return render(
    <MemoryRouter>
      <ClientListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchClients.mockReset()
  mockedFetchClients.mockResolvedValue(createClientListPage())
})

afterEach(() => {
  cleanup()
})

describe('client list page', () => {
  it('renders the client table when the lookup succeeds with data', async () => {
    renderClientListPage()

    expect(await screen.findByText('김대상')).toBeTruthy()
    expect(screen.getByText('CL-00011')).toBeTruthy()
    expect(screen.getByText('남성')).toBeTruthy()
    expect(screen.getByText('활성')).toBeTruthy()
    expect(screen.queryByText('MALE')).toBeNull()
    expect(screen.queryByText('ACTIVE')).toBeNull()
    expect(screen.getByRole('link', { name: '상세보기' }).getAttribute('href')).toBe('/clients/11')
    expect(screen.getByText('1건 / 1페이지')).toBeTruthy()
  })

  it('renders MISREGISTERED as a user-friendly Korean label', async () => {
    mockedFetchClients.mockResolvedValueOnce(
      createClientListPage({
        items: [
          {
            id: 12,
            clientNo: 'CL-00012',
            name: '이오등록',
            birthDate: '2026-03-03',
            gender: 'FEMALE',
            primaryWorkerName: '박담당',
            latestSessionDate: null,
            status: 'MISREGISTERED',
          },
        ],
        totalItems: 1,
        totalPages: 1,
      }),
    )

    renderClientListPage()

    expect(await screen.findByText('이오등록')).toBeTruthy()
    expect(screen.getByText('여성')).toBeTruthy()
    expect(screen.getByText('오등록')).toBeTruthy()
    expect(screen.queryByText('MISREGISTERED')).toBeNull()
  })

  it('keeps unknown gender and status codes from breaking the table', async () => {
    mockedFetchClients.mockResolvedValueOnce(
      createClientListPage({
        items: [
          {
            id: 13,
            clientNo: 'CL-00013',
            name: '최미정',
            birthDate: '2026-03-04',
            gender: 'UNKNOWN_GENDER',
            primaryWorkerName: '정담당',
            latestSessionDate: null,
            status: 'UNKNOWN_STATUS',
          },
        ],
        totalItems: 1,
        totalPages: 1,
      }),
    )

    renderClientListPage()

    expect(await screen.findByText('최미정')).toBeTruthy()
    expect(screen.getByText('UNKNOWN_GENDER')).toBeTruthy()
    expect(screen.getByText('UNKNOWN_STATUS')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('shows the default empty message when the lookup succeeds with no clients', async () => {
    mockedFetchClients.mockResolvedValueOnce(createEmptyClientListPage())

    renderClientListPage()

    expect(await screen.findByText('등록된 대상자가 없습니다.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a filtered empty message when the lookup succeeds with no search matches', async () => {
    const user = userEvent.setup()

    renderClientListPage()

    await screen.findByText('김대상')

    mockedFetchClients.mockResolvedValueOnce(createEmptyClientListPage())

    await user.type(screen.getByPlaceholderText('이름 검색'), '없는 대상자')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(await screen.findByText('검색 조건에 맞는 대상자가 없습니다.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an error message and retry action when the lookup fails', async () => {
    mockedFetchClients.mockRejectedValueOnce(new Error('network'))

    renderClientListPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('대상자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.queryByText('등록된 대상자가 없습니다.')).toBeNull()
    expect(screen.queryByText('검색 조건에 맞는 대상자가 없습니다.')).toBeNull()
  })

  it('retries the failed lookup with the current filters and recovers to the empty state', async () => {
    const user = userEvent.setup()

    renderClientListPage()

    await screen.findByText('김대상')

    mockedFetchClients.mockReset()
    mockedFetchClients.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(createEmptyClientListPage())

    await user.type(screen.getByPlaceholderText('이름 검색'), '없는 대상자')
    await user.click(screen.getByRole('button', { name: '검색' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('대상자 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(mockedFetchClients).toHaveBeenNthCalledWith(1, {
        name: '없는 대상자',
        birthDate: undefined,
        includeMisregistered: false,
        page: 1,
        size: 20,
      })
      expect(mockedFetchClients).toHaveBeenNthCalledWith(2, {
        name: '없는 대상자',
        birthDate: undefined,
        includeMisregistered: false,
        page: 1,
        size: 20,
      })
    })

    expect(await screen.findByText('검색 조건에 맞는 대상자가 없습니다.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('formats compact birthDate input to YYYY-MM-DD before searching', async () => {
    const user = userEvent.setup()

    renderClientListPage()

    await waitFor(() => {
      expect(mockedFetchClients).toHaveBeenCalledWith({
        name: '',
        birthDate: undefined,
        includeMisregistered: false,
        page: 1,
        size: 20,
      })
    })

    const birthDateInput = screen.getByLabelText('생년월일') as HTMLInputElement
    expect(birthDateInput.placeholder).toBe('연도. 월. 일.')
    await user.type(birthDateInput, '20260302')

    expect(birthDateInput.value).toBe('2026-03-02')

    await user.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => {
      expect(mockedFetchClients).toHaveBeenLastCalledWith({
        name: '',
        birthDate: '2026-03-02',
        includeMisregistered: false,
        page: 1,
        size: 20,
      })
    })
  })

  it('does not send an incomplete birthDate filter', async () => {
    const user = userEvent.setup()

    renderClientListPage()

    const birthDateInput = screen.getByLabelText('생년월일') as HTMLInputElement
    await user.type(birthDateInput, '202603')

    expect(birthDateInput.value).toBe('2026-03')

    await user.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => {
      expect(mockedFetchClients).toHaveBeenLastCalledWith({
        name: '',
        birthDate: undefined,
        includeMisregistered: false,
        page: 1,
        size: 20,
      })
    })
  })

  it('clamps invalid month and day input while typing', async () => {
    const user = userEvent.setup()

    renderClientListPage()

    const birthDateInput = screen.getByLabelText('생년월일') as HTMLInputElement
    await user.type(birthDateInput, '20260431')

    expect(birthDateInput.value).toBe('2026-04-30')

    await user.clear(birthDateInput)
    await user.type(birthDateInput, '20250229')

    expect(birthDateInput.value).toBe('2025-02-28')
  })
})
