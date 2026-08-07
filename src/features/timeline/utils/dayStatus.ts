import { useState, useEffect } from 'react'
import { getLocalDateString, localDateStringToMidnight } from '../transformers/timeMath'

export const SLOT_START = 0
export const SLOT_END   = 287

export type DayStatus = 'past' | 'current' | 'future'

export type DayStatusResult = {
  status: DayStatus
  isPast: boolean
  isFuture: boolean
  isCurrent: boolean
  needleAtEnd: boolean
  needleAtStart: boolean
  needleLive: boolean
}

export function computeDayStatus(
  selectedDate: string,
  today: string
): DayStatusResult {
  const sel = localDateStringToMidnight(selectedDate)
  const tod = localDateStringToMidnight(today)

  const isPast   = sel < tod
  const isFuture = sel > tod
  const isCurrent = !isPast && !isFuture

  return {
    status:          isPast ? 'past' : isFuture ? 'future' : 'current',
    isPast,
    isFuture,
    isCurrent,
    needleAtEnd:   isPast,
    needleAtStart: isFuture,
    needleLive:    isCurrent,
  }
}

export function useDayStatus(selectedDate: string): DayStatusResult {
  const [today, setToday] = useState<string>(() => getLocalDateString())

  useEffect(() => {
    const interval = setInterval(() => {
      const newToday = getLocalDateString()
      if (newToday !== today) {
        setToday(newToday)
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [today])

  return computeDayStatus(selectedDate, today)
}
