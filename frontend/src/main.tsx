import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppMetadataProvider } from './app/providers/AppMetadataProvider'
import { AuthProvider } from './app/providers/AuthProvider'
import { AppRouter } from './app/router/AppRouter'
import './shared/styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppMetadataProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </AppMetadataProvider>
  </StrictMode>,
)
