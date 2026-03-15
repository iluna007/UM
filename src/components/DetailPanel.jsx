import LocationMap from './LocationMap'
import { formatAssociationsDisplay } from '../utils/formatAssociations'

const EVENT_DETAIL_KEYS = ['keywords', 'precision', 'location', 'time', 'date', 'victims', 'attackers', 'eu', 'provincia', 'canton', 'associations']

function getEventDetails(raw) {
  if (!raw || typeof raw !== 'object') return []
  return EVENT_DETAIL_KEYS.filter((k) => raw[k] != null && raw[k] !== '' && !String(raw[k]).startsWith('col_'))
    .map((key) => ({ key, value: raw[key] }))
}

function formatEventDetailValue(item, key, value) {
  if (key === 'associations' && value != null && value !== '') {
    return formatAssociationsDisplay(item, value)
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function DetailPanel({ item, hideMap, theme = 'light', sourceLinks }) {
  if (!item) return null

  const title = item.title ?? ''
  const hasImages = item.images?.length > 0
  const hasCoordinates = item.coordinates && (item.coordinates.lat != null && item.coordinates.lng != null)
  const hasSourceLinks = Array.isArray(sourceLinks) && sourceLinks.length > 0
  const eventDetails = getEventDetails(item.raw)

  return (
    <aside className="detail-panel">
      {hasImages && (
        <div className="project-images">
          {item.images.map((src, i) => (
            <div key={i} className="project-image">
              <img src={src} alt={`${title} ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      )}
      <h3 className="detail-title">{title}</h3>
      <p className="project-description">{item.description}</p>
      {eventDetails.length > 0 && (
        <dl className="detail-event-fields">
          {eventDetails.map(({ key, value }) => (
            <div key={key} className="detail-event-row">
              <dt>{key === 'associations' ? 'Calificación' : key}</dt>
              <dd className={key === 'associations' ? 'detail-associations-stars' : ''}>
                {formatEventDetailValue(item, key, value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {hasCoordinates && (
        <>
          <p className="detail-gps">
            <small>📍 {item.gpsCoordinates ?? `${item.coordinates.lat}, ${item.coordinates.lng}`}</small>
          </p>
          {!hideMap && <LocationMap coordinates={item.coordinates} theme={theme} />}
          {item.audioRecording && (
            <div className="detail-media">
              <audio src={item.audioRecording} controls />
            </div>
          )}
        </>
      )}
      {!hasCoordinates && item.audioRecording && (
        <div className="detail-media">
          <audio src={item.audioRecording} controls />
        </div>
      )}
      {item.video && (
        <div className="detail-media">
          <video src={item.video} controls />
        </div>
      )}
      {hasSourceLinks && (
        <div className="detail-sources">
          <h4 className="detail-sources-title">Fuentes</h4>
          <ul className="detail-sources-list">
            {sourceLinks.map((src, i) => (
              <li key={src.id || i}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="detail-source-link">
                  {src.description || src.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
