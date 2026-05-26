import { formatBold } from '../../../services/formatBold'
import './PlanCard.css'

const EXPERIENCE_LABELS = {
  balanced:   'Balanced',
  budget:     'Budget',
  luxury:     'Luxury',
  adventure:  'Adventure',
  food:       'Food Trip',
  relaxation: 'Relaxation',
  cultural:   'Cultural',
  romantic:   'Romantic',
  family:     'Family',
}

export function PlanCard({ icon, title, brief, price, tone = 'a', experienceType, onClick }) {
  const expLabel = EXPERIENCE_LABELS[experienceType] || experienceType || null

  return (
    <button className={`plan-card plan-card--${tone}`} onClick={onClick} type="button">
      <div className="plan-card__hero">
        <span className="plan-card__icon" aria-hidden="true">{icon}</span>
        <div className="plan-card__hero-right">
          {expLabel && (
            <span className="plan-card__exp-badge">{expLabel}</span>
          )}
          {price > 0 && (
            <span className="plan-card__price">~${Number(price).toLocaleString()}</span>
          )}
        </div>
      </div>
      <div className="plan-card__body">
        <span className="plan-card__title">{formatBold(title)}</span>
        <span className="plan-card__brief">{formatBold(brief)}</span>
        <span className="plan-card__cta">View details →</span>
      </div>
    </button>
  )
}
