import { useState } from 'react'
import { PlanCard } from './PlanCard'
import { PlanDetail } from './PlanDetail'

const PLAN_ICONS = ['🏆', '💰', '⚖️']

export function MyPlans({ savedPlans, onSwitchToPlanner }) {
  const [openId, setOpenId] = useState(null)
  const open = savedPlans.find((sp) => sp.id === openId) || null

  if (open) {
    return (
      <PlanDetail
        section={open.plan}
        onBack={() => setOpenId(null)}
        savedIndicatorOnly
      />
    )
  }

  return (
    <div>
      <div className="my-plans__header">
        <h2 className="my-plans__title">My Plans</h2>
        <p className="my-plans__sub">
          {savedPlans.length === 0
            ? 'Plans you save from the planner will appear here.'
            : `${savedPlans.length} saved ${savedPlans.length === 1 ? 'plan' : 'plans'}`}
        </p>
      </div>

      {savedPlans.length === 0 ? (
        <div className="my-plans__empty">
          <span className="my-plans__empty-mark" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
          </span>
          <p className="my-plans__empty-text">
            Generate a plan, open it, then hit{' '}
            <strong>Save This Plan</strong> to add it here.
          </p>
          <button className="my-plans__empty-cta" onClick={onSwitchToPlanner}>
            Plan a trip →
          </button>
        </div>
      ) : (
        <div className="plan-cards">
          {savedPlans.map((sp, i) => (
            <PlanCard
              key={sp.id}
              icon={PLAN_ICONS[i % PLAN_ICONS.length]}
              title={sp.plan.title}
              brief={sp.plan.brief}
              price={sp.plan.total_price}
              onClick={() => setOpenId(sp.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
