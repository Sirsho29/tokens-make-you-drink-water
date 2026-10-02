import { useCallback, useEffect, useState } from 'react'
import type { WidgetState } from '@shared/types'
import { bridge } from './bridge'

export function useWidgetState(): {
  state: WidgetState | null
  error: string | null
  retry: () => void
} {
  const [state, setState] = useState<WidgetState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const api = bridge()

    api
      .getState()
      .then((next) => {
        if (active) {
          setState(next)
          setError(null)
        }
      })
      .catch(() => {
        if (active) setError('Could not reach the widget service')
      })

    const unsubscribe = api.onStateChanged((next) => {
      if (active) {
        setState(next)
        setError(null)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { state, error, retry }
}
