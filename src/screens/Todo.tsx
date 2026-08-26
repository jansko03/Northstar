import { color, label } from '../lib/tokens'

export function Todo({ name }: { name: string }) {
  return (
    <div style={{ padding: 32 }}>
      <span style={{ ...label, color: color.dim }}>{name} — todo</span>
    </div>
  )
}
