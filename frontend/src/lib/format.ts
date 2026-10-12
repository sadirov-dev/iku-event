import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

const LOCALES: Record<string, string> = { ky: 'ky-KG', ru: 'ru-RU', en: 'en-GB' }

/** "понедельник, 5 октября" → "Понедельник, 5 октября" (CSS `capitalize` would upper-case every word). */
const capFirst = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/** Parse "YYYY-MM-DD" as a local calendar date (no UTC shift). */
export function parseDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Monday-based start of week. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export function useFormat() {
  const { i18n, t } = useTranslation()
  const locale = LOCALES[i18n.resolvedLanguage ?? 'ru'] ?? 'ru-RU'

  return useMemo(() => {
    const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, opts)
    const dayMonth = fmt({ day: 'numeric', month: 'long' })
    const full = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const short = fmt({ day: 'numeric', month: 'short' })
    const dateTime = fmt({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const weekdayShort = fmt({ weekday: 'short' })
    const monthYear = fmt({ month: 'long', year: 'numeric' })

    const today = toISODate(new Date())
    const tomorrow = toISODate(addDays(new Date(), 1))

    return {
      locale,
      /** "5 октября", or "Сегодня"/"Завтра" when relevant. */
      eventDay: (date: string) =>
        date === today ? t('event.today') : date === tomorrow ? t('event.tomorrow') : dayMonth.format(parseDate(date)),
      dayMonth: (date: string) => dayMonth.format(parseDate(date)),
      fullDate: (date: string) => capFirst(full.format(parseDate(date))),
      shortDate: (date: string | Date) => short.format(typeof date === 'string' ? new Date(date) : date),
      dateTime: (iso: string) => dateTime.format(new Date(iso)),
      weekdayShort: (d: Date) => weekdayShort.format(d),
      monthYear: (d: Date) => capFirst(monthYear.format(d)),
      relative: (iso: string) => {
        const diff = (new Date(iso).getTime() - Date.now()) / 1000
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
        const abs = Math.abs(diff)
        if (abs < 60) return rtf.format(Math.round(diff), 'second')
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
        if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day')
        return short.format(new Date(iso))
      },
    }
  }, [locale, t])
}
