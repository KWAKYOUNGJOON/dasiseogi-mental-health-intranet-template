import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchAppMetadata, type AppMetadata } from '../../features/app-metadata/api/appMetadataApi'

export type AppMetadataStatus = 'loading' | 'ready' | 'error'

interface AppMetadataContextValue {
  metadata: AppMetadata | null
  organizationName: string
  positionNames: readonly string[]
  status: AppMetadataStatus
  refresh: () => Promise<void>
}

function getTestFallbackContext(): AppMetadataContextValue | null {
  const candidate = (
    globalThis as typeof globalThis & {
      __TEST_APP_METADATA__?: Partial<AppMetadataContextValue>
    }
  ).__TEST_APP_METADATA__

  if (!candidate) {
    return null
  }

  const metadata = candidate.metadata ?? {
    organizationName: candidate.organizationName ?? '',
    positionNames: [...(candidate.positionNames ?? [])],
  }

  return {
    metadata,
    organizationName: candidate.organizationName ?? metadata.organizationName,
    positionNames: candidate.positionNames ?? metadata.positionNames,
    status: candidate.status ?? 'ready',
    refresh: candidate.refresh ?? (async () => {}),
  }
}

const EMPTY_CONTEXT: AppMetadataContextValue =
  getTestFallbackContext() ?? {
    metadata: null,
    organizationName: '',
    positionNames: [],
    status: 'loading',
    refresh: async () => {},
  }

const AppMetadataContext = createContext<AppMetadataContextValue>(EMPTY_CONTEXT)

export function AppMetadataProvider({ children }: { children: ReactNode }) {
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)
  const [status, setStatus] = useState<AppMetadataStatus>('loading')

  async function refresh() {
    setStatus('loading')

    try {
      const nextMetadata = await fetchAppMetadata()
      setMetadata(nextMetadata)
      setStatus('ready')
    } catch {
      setMetadata(null)
      setStatus('error')
    }
  }

  useEffect(() => {
    let active = true

    async function load() {
      setStatus('loading')

      try {
        const nextMetadata = await fetchAppMetadata()
        if (!active) {
          return
        }
        setMetadata(nextMetadata)
        setStatus('ready')
      } catch {
        if (!active) {
          return
        }
        setMetadata(null)
        setStatus('error')
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return (
    <AppMetadataContext.Provider
      value={{
        metadata,
        organizationName: metadata?.organizationName ?? '',
        positionNames: metadata?.positionNames ?? [],
        status,
        refresh,
      }}
    >
      {children}
    </AppMetadataContext.Provider>
  )
}

export function useAppMetadata() {
  return useContext(AppMetadataContext)
}
