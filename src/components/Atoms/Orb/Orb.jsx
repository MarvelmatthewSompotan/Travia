import './Orb.css'

export function Orb({ size = 96 }) {
  return <span className="orb" style={{ width: size, height: size }} aria-hidden="true" />
}
