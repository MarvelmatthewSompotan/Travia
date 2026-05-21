import './Chip.css'

export function Chip({ icon, children, active = false, className = '', ...rest }) {
  return (
    <button className={`chip${active ? ' chip--active' : ''} ${className}`.trim()} type="button" {...rest}>
      {icon && <span className="chip__icon">{icon}</span>}
      <span className="chip__label">{children}</span>
    </button>
  )
}
