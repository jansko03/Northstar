import { NavLink } from 'react-router-dom'
import { color, font, label } from '../lib/tokens'

const links = [
  { to: '/network', text: 'Network' },
  { to: '/import', text: 'Import' },
  { to: '/pulse', text: 'Pulse' },
  { to: '/profile', text: 'Profile' },
]

export function NavBar() {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: color.accent,
            boxShadow: '0 0 14px 2px rgba(79,227,155,.55)',
          }}
        />
        <span
          style={{
            fontFamily: font.mono,
            fontSize: 13,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: color.text,
          }}
        >
          Northstar
        </span>
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
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              ...label,
              display: 'flex',
              alignItems: 'center',
              padding: '7px 14px',
              borderRadius: 11,
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
      </div>
    </nav>
  )
}
