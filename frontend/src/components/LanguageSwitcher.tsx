import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { LANGUAGES, type Lang } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { cn } from './ui'

const FLAGS: Record<Lang, string> = { ky: '🇰🇬', ru: '🇷🇺', en: '🇬🇧' }
const SHORT: Record<Lang, string> = { ky: 'KY', ru: 'RU', en: 'EN' }

/** Segmented KY | RU | EN switch. Switching is instant and saved to the profile for signed-in users. */
export default function LanguageSwitcher({ full = false, className }: { full?: boolean; className?: string }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const current = i18n.resolvedLanguage as Lang

  const change = (lang: Lang) => {
    if (lang === current) return
    i18n.changeLanguage(lang)
    if (user) {
      api
        .updateProfile({ language: lang })
        .then((u) => queryClient.setQueryData(['me'], u))
        .catch(() => {
          /* UI language already switched; persisting it is best-effort */
        })
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('nav.language')}
      className={cn('rounded-xl border border-slate-200 bg-white p-0.5', full ? 'flex w-full' : 'inline-flex', className)}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          role="radio"
          aria-checked={current === lang}
          onClick={() => change(lang)}
          title={t(`languages.${lang}`)}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition',
            full && 'flex-1 justify-center px-3 py-2 text-sm',
            current === lang ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <span aria-hidden>{FLAGS[lang]}</span>
          {full ? t(`languages.${lang}`) : SHORT[lang]}
        </button>
      ))}
    </div>
  )
}
