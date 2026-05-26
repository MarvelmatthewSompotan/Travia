import { useState } from 'react'
import { PlanCard } from '../../Molecules/PlanCard/PlanCard'
import { PlanDetail } from '../../Molecules/PlanDetail/PlanDetail'
import suitcaseIcon from '../../../assets/icons/u_suitcase-alt.svg'
import mapIcon from '../../../assets/icons/u_map-marker-alt.svg'
import planeIcon from '../../../assets/icons/u_plane-fly.svg'
import './MyPlans.css'

const PLAN_ICON_SRCS = [suitcaseIcon, mapIcon, planeIcon]
const PLAN_TONES = ['a', 'b', 'c']

export function MyPlans({ savedPlans, onSwitchToPlanner, onDelete }) {
  const [openId, setOpenId] = useState(null)
  const open = savedPlans.find((sp) => sp.id === openId) || null

  if (open) {
    return (
      <div className="my-plans">
        <PlanDetail
          section={open.plan}
          onBack={() => setOpenId(null)}
          savedIndicatorOnly
        />
        {onDelete && (
          <button
            type="button"
            className="my-plans__delete"
            onClick={async () => {
              await onDelete(open.id)
              setOpenId(null)
            }}
          >Remove from My Plans</button>
        )}
      </div>
    )
  }

  return (
    <div className="my-plans">
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
            <strong>Save plan</strong> to add it here.
          </p>
          <button className="my-plans__empty-cta" onClick={onSwitchToPlanner}>
            Plan a trip →
          </button>
        </div>
      ) : (
        <div className="my-plans__grid">
          {savedPlans.map((sp, i) => (
            <PlanCard
              key={sp.id}
              icon={<img src={PLAN_ICON_SRCS[i % PLAN_ICON_SRCS.length]} alt="" aria-hidden="true" className="plan-card__icon-img" />}
              tone={PLAN_TONES[i % PLAN_TONES.length]}
              title={sp.title}
              brief={sp.brief}
              price={sp.plan?.total_price}
              onClick={() => setOpenId(sp.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
