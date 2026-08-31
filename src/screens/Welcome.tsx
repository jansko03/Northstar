import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { cardShadow, color, font, label, radius, surfaceGradient } from '../lib/tokens'

export function Welcome() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus('sending')
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    setStatus('sent')
  }

  const canSubmit = status !== 'sending' && !!email.trim()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: color.bg,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          padding: 32,
          background: surfaceGradient,
          border: `1px solid ${color.border}`,
          borderRadius: radius.lg,
          boxShadow: cardShadow,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color.accent,
                boxShadow: '0 0 14px 2px rgba(79,227,155,.55)',
              }}
            />
            <span
              style={{
                fontFamily: font.mono,
                fontSize: 15,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: color.text,
              }}
            >
              Northstar
            </span>
          </div>
          <span style={{ fontSize: 14, color: color.muted, lineHeight: 1.5 }}>
            Who should I contact this week, and why.
          </span>
        </div>

        {status === 'sent' ? (
          <div style={{ ...label, color: color.accent, textAlign: 'center', lineHeight: 1.7 }}>
            Check {email} for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                background: color.surface,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                padding: '11px 13px',
                color: color.text,
                fontFamily: font.body,
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                ...label,
                padding: '12px',
                textAlign: 'center',
                background: canSubmit ? color.accent : color.surface,
                border: `1px solid ${canSubmit ? color.accent : color.border}`,
                borderRadius: radius.sm,
                color: canSubmit ? '#080908' : color.dim,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {status === 'error' && errorMessage && (
              <span style={{ ...label, color: color.lime }}>{errorMessage}</span>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
