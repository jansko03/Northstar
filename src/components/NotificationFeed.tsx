import { Link } from 'react-router-dom'
import { cardShadow, color, font, kindLabel, label, radius, surfaceGradient } from '../lib/tokens'
import type { SimNotification } from '../lib/types'

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function NotificationFeed({
  notifications,
  unreadCount,
  configured,
  loading,
  onClear,
}: {
  notifications: SimNotification[]
  unreadCount: number
  configured: boolean
  loading: boolean
  onClear: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 20,
        background: surfaceGradient,
        border: `1px solid ${color.border}`,
        boxShadow: cardShadow,
        borderRadius: radius.lg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ ...label, color: color.muted }}>Notifications</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {unreadCount > 0 && <span style={{ ...label, color: color.accent }}>{unreadCount} new</span>}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                ...label,
                fontSize: 9.5,
                padding: '5px 9px',
                background: 'transparent',
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm - 2,
                color: color.muted,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <span style={{ fontSize: 13, color: color.dim }}>Loading…</span>
      ) : !configured ? (
        <span style={{ fontSize: 13, color: color.dim }}>
          Nothing to notify about yet. Pick signal kinds or watch someone in Admin.
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationRow({ notification }: { notification: SimNotification }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
      <span
        style={{
          width: 5,
          height: 5,
          marginTop: 1,
          borderRadius: '50%',
          flexShrink: 0,
          background: notification.unread ? color.accent : 'transparent',
          boxShadow: notification.unread ? '0 0 8px 1px rgba(0,255,58,.5)' : 'none',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Link
            to={`/contact/${notification.contactId}`}
            style={{
              fontFamily: font.body,
              fontSize: 13,
              fontWeight: 500,
              color: color.text,
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {notification.contactName}
            {notification.company && (
              <span style={{ color: color.dim, fontWeight: 400 }}> · {notification.company}</span>
            )}
          </Link>
          <span style={{ ...label, color: color.dim, fontSize: 9.5, flexShrink: 0 }}>
            {clockTime(notification.at)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...label, color: color.accent, flexShrink: 0 }}>{kindLabel[notification.kind]}</span>
          <span style={{ fontSize: 12.5, color: color.muted }}>{notification.detail}</span>
        </div>
      </div>
    </div>
  )
}
