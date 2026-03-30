import type { ReactNode } from 'react'

interface AuthFormShellProps {
  children: ReactNode
  description?: ReactNode
  title: string
}

export function AuthFormShell({ children, description, title }: AuthFormShellProps) {
  return (
    <main className="login-shell">
      <section className="card login-card stack">
        <div>
          <h1 style={{ marginBottom: 8 }}>{title}</h1>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {children}
      </section>
    </main>
  )
}
