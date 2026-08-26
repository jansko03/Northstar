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
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '18px 32px',
        borderBottom: `1px solid ${color.border}`,
      }}
    >
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 13,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: color.accent,
          marginRight: 12,
        }}
      >
        Northstar
      </span>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            ...label,
            color: isActive ? color.text : color.muted,
            textDecoration: 'none',
          })}
        >
          {link.text}
        </NavLink>
      ))}
    </nav>
  )
}
