import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchClients } from '../src/features/clients/api/clientApi'
import { ClientListPage } from '../src/pages/clients/ClientListPage'

vi.mock('../src/features/clients/api/clientApi', () => ({
  fetchClients: vi.fn(),
}))

const mockedFetchClients = vi.mocked(fetchClients)

function createClientListPage() {
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
