import { formatBold } from '../lib/formatBold'

export function PlanCard({ icon, title, brief, price, onClick }) {
  return (
    <button className="plan-card" onClick={onClick} type="button">
      <div className="plan-card__hero">
        <span className="plan-card__icon" aria-hidden="true">{icon}</span>
        {price > 0 && (
          <span className="plan-card__price">~${Number(price).toLocaleString()}</span>
        )}
      </div>
      <div className="plan-card__body">
        <span className="plan-card__title">{formatBold(title)}</span>
        <span className="plan-card__brief">{formatBold(brief)}</span>
        <span className="plan-card__cta">View details →</span>
      </div>
    </button>
  )
}
