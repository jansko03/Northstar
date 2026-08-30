import { Link } from 'react-router-dom'
import { color, label } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'

interface SignalRowProps {
  date: string
  kind: string
  detail?: string | null
  contact?: { id: string; name: string }
}

export function SignalRow({ date, kind, detail, contact }: SignalRowProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {contact ? (
            <Link to={`/contact/${contact.id}`} style={{ ...label, color: color.text, textDecoration: 'none' }}>
              {contact.name}
            </Link>
          ) : (
            <span style={{ ...label, color: color.dim }}>{date}</span>
          )}
          <span style={{ ...label, color: color.accent, flexShrink: 0 }}>{kind}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {contact && <span style={{ ...label, color: color.dim, flexShrink: 0 }}>{date}</span>}
          {detail && <span style={{ fontSize: 13, color: color.muted }}>{detail}</span>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span style={{ ...label, color: color.dim, width: 90, flexShrink: 0 }}>{date}</span>
      {contact && (
        <Link
          to={`/contact/${contact.id}`}
          style={{ ...label, color: color.text, width: 160, flexShrink: 0, textDecoration: 'none' }}
        >
          {contact.name}
        </Link>
      )}
      <span style={{ ...label, color: color.accent, width: contact ? 100 : 90, flexShrink: 0 }}>{kind}</span>
      {detail && <span style={{ fontSize: 13, color: color.muted }}>{detail}</span>}
    </div>
  )
}
