import { NavLink } from 'react-router-dom'
import { color, font, label } from '../lib/tokens'
import { useIsMobile } from '../lib/useIsMobile'

const links = [
  { to: '/network', text: 'Network' },
  { to: '/import', text: 'Import' },
  { to: '/pulse', text: 'Pulse' },
  { to: '/profile', text: 'Profile' },
  { to: '/admin', text: 'Admin' },
]

export const MOBILE_BOTTOM_NAV_HEIGHT = 60

function NavLinks({ mobile }: { mobile: boolean }) {
  return (
    <>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            ...label,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: mobile ? 1 : undefined,
            padding: mobile ? '10px 6px' : '7px 14px',
            borderRadius: mobile ? 10 : 11,
            color: isActive ? color.accent : color.muted,
            background: isActive
              ? 'linear-gradient(180deg, rgba(79,227,155,.19), rgba(79,227,155,.07))'
              : 'transparent',
            boxShadow: isActive
              ? '0 1px 0 rgba(255,255,255,.07) inset, 0 6px 18px -12px rgba(79,227,155,.7)'
              : 'none',
            textDecoration: 'none',
          })}
        >
          {link.text}
        </NavLink>
      ))}
    </>
  )
}

function Wordmark({ dotSize, fontSize }: { dotSize: number; fontSize: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: color.accent,
          boxShadow: '0 0 14px 2px rgba(79,227,155,.55)',
        }}
      />
      <span
        style={{
          fontFamily: font.mono,
          fontSize,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: color.text,
        }}
      >
        Northstar
      </span>
    </div>
  )
}

export function NavBar() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <>
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            height: 44,
            padding: '0 16px',
            background: 'rgba(9,10,9,.72)',
            backdropFilter: 'blur(22px) saturate(150%)',
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <Wordmark dotSize={8} fontSize={12} />
        </nav>
        <nav
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            display: 'flex',
            gap: 3,
            padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
            background: 'rgba(9,10,9,.92)',
            backdropFilter: 'blur(22px) saturate(150%)',
            borderTop: `1px solid ${color.border}`,
          }}
        >
          <NavLinks mobile />
        </nav>
      </>
    )
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 64,
        padding: '0 32px',
        background: 'rgba(9,10,9,.72)',
        backdropFilter: 'blur(22px) saturate(150%)',
        borderBottom: `1px solid ${color.border}`,
      }}
    >
      <div style={{ marginRight: 8 }}>
        <Wordmark dotSize={9} fontSize={13} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: 3,
          background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.014))',
          border: `1px solid ${color.border}`,
          borderRadius: 15,
        }}
      >
        <NavLinks mobile={false} />
      </div>
    </nav>
  )
}
