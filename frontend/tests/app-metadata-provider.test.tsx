import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppMetadataProvider, useAppMetadata } from '../src/app/providers/AppMetadataProvider'
import { fetchAppMetadata } from '../src/features/app-metadata/api/appMetadataApi'

vi.mock('../src/features/app-metadata/api/appMetadataApi', () => ({
  fetchAppMetadata: vi.fn(),
}))

const mockedFetchAppMetadata = vi.mocked(fetchAppMetadata)

function AppMetadataConsumer() {
  const { organizationName, positionNames, status } = useAppMetadata()

  return (
    <div>
      <span data-testid="organization-name">{organizationName}</span>
      <span data-testid="position-names">{positionNames.join(',')}</span>
      <span data-testid="status">{status}</span>
    </div>
  )
}

describe('app metadata provider', () => {
  it('loads organization name and position options from the backend metadata API', async () => {
    mockedFetchAppMetadata.mockResolvedValue({
      organizationName: '기관 메타데이터 제목',
      positionNames: ['센터장', '코디네이터', '실무자'],
    })

    render(
      <AppMetadataProvider>
        <AppMetadataConsumer />
      </AppMetadataProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    })
    expect(screen.getByTestId('organization-name')).toHaveTextContent('기관 메타데이터 제목')
    expect(screen.getByTestId('position-names')).toHaveTextContent('센터장,코디네이터,실무자')
  })
})
