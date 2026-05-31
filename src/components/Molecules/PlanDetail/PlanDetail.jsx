import { formatBold } from '../../../services/formatBold'
import './PlanDetail.css'

function formatMoney(value) {
  if (value == null) return '—'
  return `$${Number(value).toLocaleString()}`
}

function stopsLabel(stops) {
  if (stops === 0) return 'Nonstop'
  return `${stops} stop${stops > 1 ? 's' : ''}`
}

const TRIP_TYPE_LABELS = {
  COUPLES:  { label: 'Couples',           emoji: '💑' },
  FAMILY:   { label: 'Families',          emoji: '👨‍👩‍👧' },
  SOLO:     { label: 'Solo travelers',    emoji: '🎒' },
  BUSINESS: { label: 'Business',          emoji: '💼' },
  FRIENDS:  { label: 'Groups of friends', emoji: '👥' },
}

function BestForBadge({ dominantTripType, tripTypeSource }) {
  if (!dominantTripType) return null
  const info = TRIP_TYPE_LABELS[dominantTripType]
  const label = info ? `${info.emoji} ${info.label}` : dominantTripType
  const tooltip = tripTypeSource === 'tripadvisor' ? 'via TripAdvisor' : 'via Travia AI'
  return (
    <span className="best-for-badge" title={tooltip}>
      Best for: {label}
    </span>
  )
}

function SubScoreBars({ subscores }) {
  if (!subscores) return null
  const entries = Object.entries(subscores)
  if (!entries.length) return null
  return (
    <div className="subscore-bars">
      {entries.map(([key, val]) => (
        <div key={key} className="subscore-row">
          <span className="subscore-label">{key}</span>
          <div className="subscore-track">
            <div
              className="subscore-fill"
              style={{ width: `${((val - 1) / 4) * 100}%` }}
            />
          </div>
          <span className="subscore-value">{val.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

function RedFlags({ redFlags }) {
  if (!redFlags?.length) return null
  return (
    <div className="red-flags">
      {redFlags.map((flag, i) => (
        <div key={i} className={`red-flag-item red-flag-item--${flag.severity.toLowerCase()}`}>
          <span className="red-flag-severity">{flag.severity}</span>
          <span className="red-flag-confidence">{Math.round(flag.confidence * 100)}%</span>
          {flag.snippet && <span className="red-flag-snippet">"{flag.snippet}"</span>}
        </div>
      ))}
    </div>
  )
}

function FlightSection({ flight, flightError }) {
  return (
    <section className="plan-section">
      <h3 className="plan-section__heading">Flight</h3>
      {flight ? (
        <div className="detail-card">
          <div className="detail-card__title-row">
            {flight.airline_logo && (
              <img className="detail-card__logo" src={flight.airline_logo} alt="" />
            )}
            <span className="detail-card__value">{flight.airline}</span>
          </div>
          {(flight.departure_iata || flight.arrival_iata) && (
            <div className="detail-card__row">
              <span className="detail-card__label">Route</span>
              <span className="detail-card__value detail-card__value--route">
                {flight.departure_city || flight.departure_iata}
                {' '}
                <span className="route-arrow">→</span>
                {' '}
                {flight.destination_name?.split(',')[0] || flight.arrival_iata}
                <span className="route-iata"> ({flight.departure_iata} → {flight.arrival_iata})</span>
              </span>
            </div>
          )}
          <div className="detail-card__row">
            <span className="detail-card__label">Departs</span>
            <span className="detail-card__value">{flight.departure_time || '—'}</span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Arrives</span>
            <span className="detail-card__value">{flight.arrival_time || '—'}</span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Duration</span>
            <span className="detail-card__value">
              {flight.duration_hours != null ? `${flight.duration_hours} h` : '—'} · {stopsLabel(flight.stops)}
            </span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Price</span>
            <span className="detail-card__value detail-card__value--price">{formatMoney(flight.price)}</span>
          </div>
          {flight.link && (
            <a className="detail-link" href={flight.link} target="_blank" rel="noreferrer">
              View flight ↗
            </a>
          )}
        </div>
      ) : (
        <p className="detail-empty">{flightError || 'Flight data unavailable.'}</p>
      )}
    </section>
  )
}

function HotelSection({ hotel }) {
  return (
    <section className="plan-section">
      <h3 className="plan-section__heading">Hotel</h3>
      {hotel ? (
        <div className="detail-card">
          <div className="detail-card__title-row">
            <span className="detail-card__value">{hotel.name}</span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Rating</span>
            <span className="detail-card__value">
              {hotel.rating != null ? `★ ${hotel.rating}` : '—'}
              {hotel.hotel_class ? ` · ${hotel.hotel_class}` : ''}
            </span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Per night</span>
            <span className="detail-card__value">{formatMoney(hotel.price_per_night)}</span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Stay</span>
            <span className="detail-card__value">
              {hotel.nights} night{hotel.nights > 1 ? 's' : ''}
            </span>
          </div>
          <div className="detail-card__row">
            <span className="detail-card__label">Total</span>
            <span className="detail-card__value detail-card__value--price">{formatMoney(hotel.total_price)}</span>
          </div>
          {hotel.link && (
            <a className="detail-link" href={hotel.link} target="_blank" rel="noreferrer">
              View hotel ↗
            </a>
          )}
          {hotel.subscores && (
            <div className="detail-card__subscores">
              <p className="subscore-heading">Quality breakdown</p>
              <SubScoreBars subscores={hotel.subscores} />
            </div>
          )}
          <RedFlags redFlags={hotel.red_flags} />
        </div>
      ) : (
        <p className="detail-empty">Hotel data unavailable.</p>
      )}
    </section>
  )
}

function PlacesSection({ places }) {
  const hasAnyReviews = places?.some((p) => p.review_snippets?.length > 0)

  return (
    <section className="plan-section">
      <h3 className="plan-section__heading">Itinerary</h3>
      {places && places.length > 0 ? (
        <>
          <ol className="places-timeline">
            {places.map((place, i) => {
              const displayRating = place.tripadvisor_rating ?? place.rating
              const reviewCount = place.tripadvisor_review_count ?? place.reviews
              return (
                <li key={i} className="place-node">
                  <span className="place-node__marker">{i + 1}</span>
                  <div className="place-node__body">
                    <p className="place-node__name">{place.name}</p>
                    <p className="place-node__meta">
                      {displayRating != null && (
                        <span>★ {displayRating}{reviewCount != null ? ` (${Number(reviewCount).toLocaleString()})` : ''}</span>
                      )}
                      {place.price && <span>{place.price}</span>}
                      {place.type && <span>{place.type}</span>}
                    </p>
                    {place.best_for && (
                      <BestForBadge
                        dominantTripType={place.dominant_trip_type}
                        tripTypeSource={place.trip_type_source}
                      />
                    )}
                    {place.description && (
                      <p className="place-node__desc">{place.description}</p>
                    )}
                    {place.review_snippets?.length > 0 && (
                      <p className="place-node__snippet">"{place.review_snippets[0]}"</p>
                    )}
                    {place.subscores && (
                      <div className="place-node__subscores">
                        <SubScoreBars subscores={place.subscores} />
                      </div>
                    )}
                    <RedFlags redFlags={place.red_flags} />
                  </div>
                </li>
              )
            })}
          </ol>

          {hasAnyReviews && (
            <details className="reviews-section">
              <summary className="reviews-section__toggle">Traveller reviews</summary>
              <div className="reviews-section__body">
                {places.filter((p) => p.review_snippets?.length > 0).map((place, i) => (
                  <div key={i} className="reviews-place">
                    <p className="reviews-place__name">{place.name}</p>
                    <ul className="reviews-place__list">
                      {place.review_snippets.map((snippet, j) => (
                        <li key={j} className="reviews-place__item">"{snippet}"</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <p className="detail-empty">No places found for this destination.</p>
      )}
    </section>
  )
}

export function PlanDetail({ section, onBack, onSave, isSaved, savedIndicatorOnly }) {
  const { flight, hotel } = section

  return (
    <div className="plan-detail">
      <button className="plan-detail__back" onClick={onBack} type="button">
        ← Back
      </button>
      <h2 className="plan-detail__title">{formatBold(section.title)}</h2>
      {section.brief && <p className="plan-detail__brief">{formatBold(section.brief)}</p>}

      <FlightSection flight={flight} flightError={section.flightError} />
      <HotelSection hotel={hotel} />
      <PlacesSection places={section.places} />

      <div className="plan-total">
        <div className="plan-total__amount">
          Estimated total: {formatMoney(section.total_price)}
        </div>
        <div className="plan-total__breakdown">
          Flight {formatMoney(flight?.price)} + Hotel {formatMoney(hotel?.total_price)}
        </div>
      </div>

      {(onSave || savedIndicatorOnly) && (
        <button
          type="button"
          className={`plan-detail__save${isSaved || savedIndicatorOnly ? ' plan-detail__save--saved' : ''}`}
          onClick={onSave}
          disabled={isSaved || savedIndicatorOnly}
        >
          {isSaved || savedIndicatorOnly ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved to My Plans
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Save this plan
            </>
          )}
        </button>
      )}
    </div>
  )
}
