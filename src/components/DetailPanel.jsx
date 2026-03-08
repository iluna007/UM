export default function DetailPanel({ item }) {
  if (!item) return null

  const title = item.title ?? ''
  const hasImages = item.images?.length > 0

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
      {item.gpsCoordinates && (
        <p className="detail-gps">
          <small>📍 {item.gpsCoordinates}</small>
        </p>
      )}
      {item.video && (
        <div className="detail-media">
          <video src={item.video} controls />
        </div>
      )}
      {item.audioRecording && (
        <div className="detail-media">
          <audio src={item.audioRecording} controls />
        </div>
      )}
    </aside>
  )
}
