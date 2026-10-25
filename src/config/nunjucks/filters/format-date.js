import { format } from 'date-fns/format'
import { isDate } from 'date-fns/isDate'
import { parseISO } from 'date-fns/parseISO'

export function formatDate(value, formattedDateStr = 'EEE do MMMM yyyy') {
  const date = isDate(value) ? value : parseISO(value)

  return format(date, formattedDateStr)
}
