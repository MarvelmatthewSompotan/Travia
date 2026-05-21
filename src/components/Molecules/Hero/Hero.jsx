import { Orb } from '../../Atoms/Orb/Orb'
import './Hero.css'

export function Hero({ title, accent, subtitle }) {
  return (
    <div className="hero">
      <Orb size={96} />
      <h1 className="hero__title">
        {title}
        {accent && (
          <>
            {' '}
            <span className="hero__accent">{accent}</span>
            {'?'}
          </>
        )}
      </h1>
      {subtitle && <p className="hero__sub">{subtitle}</p>}
    </div>
  )
}
