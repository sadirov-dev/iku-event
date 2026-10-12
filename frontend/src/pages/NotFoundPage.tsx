import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../components/ui'

export default function NotFoundPage({ forbidden = false }: { forbidden?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={forbidden ? '🔒' : '🧭'}
        title={forbidden ? t('errors.FORBIDDEN') : t('common.notFoundTitle')}
        text={forbidden ? undefined : t('common.notFoundText')}
        action={<Link to="/" className="btn-primary">{t('common.goHome')}</Link>}
      />
    </div>
  )
}
