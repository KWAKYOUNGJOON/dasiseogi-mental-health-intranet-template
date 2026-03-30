import { ClientCreateForm } from '../../features/clients/components/ClientCreateForm'
import { PageHeader } from '../../shared/components/PageHeader'

export function ClientCreatePage() {
  return (
    <div className="stack">
      <PageHeader description="담당자는 현재 로그인 사용자로 기본 지정됩니다." title="대상자 등록" />
      <ClientCreateForm />
    </div>
  )
}
