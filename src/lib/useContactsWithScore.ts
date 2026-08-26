import { useEffect, useState } from 'react'
import { DEFAULT_USER_ID, supabase } from './supabase'
import type { Contact, ContactScore, ContactWithScore } from './types'

interface State {
  contacts: ContactWithScore[]
  loading: boolean
  error: string | null
}

export function useContactsWithScore(): State {
  const [state, setState] = useState<State>({ contacts: [], loading: true, error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [contactsRes, scoresRes] = await Promise.all([
        supabase.from('contact').select('*').eq('user_id', DEFAULT_USER_ID),
        supabase.from('contact_score').select('*').eq('user_id', DEFAULT_USER_ID),
      ])

      if (cancelled) return

      if (contactsRes.error) {
        setState({ contacts: [], loading: false, error: contactsRes.error.message })
        return
      }
      if (scoresRes.error) {
        setState({ contacts: [], loading: false, error: scoresRes.error.message })
        return
      }

      const scoresById = new Map<string, ContactScore>(
        (scoresRes.data as ContactScore[]).map((s) => [s.id, s]),
      )

      const merged: ContactWithScore[] = (contactsRes.data as Contact[])
        .map((c) => ({ ...c, score: scoresById.get(c.id) ?? null }))
        .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0))

      setState({ contacts: merged, loading: false, error: null })
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
