import { useState } from 'react'
import { archive } from '../data/archive'
import { getSortedArchive } from '../utils/sortArchive'
import SoundTrackRow from '../components/SoundTrackRow'

export default function SoundAnalysis() {
  const [sortBy, setSortBy] = useState('year')
  const { grouped, keys } = getSortedArchive(archive, sortBy)
  const allItems = keys.flatMap((k) => grouped[k])

  return (
    <div className="page sound-analysis">
      
      <div className="sound-analysis-table-container">
        <div className="sound-track-header">
          <span className="sound-track-header-play" aria-hidden />
          <span className="sound-track-header-num">#</span>
          <span className="sound-track-header-artwork" aria-hidden />
          <div className="sound-track-header-info">
            <button
              type="button"
              className={`sound-sort-btn ${sortBy === 'title' ? 'active' : ''}`}
              onClick={() => setSortBy('title')}
            >
              Title
            </button>
            <button
              type="button"
              className={`sound-sort-btn ${sortBy === 'date' ? 'active' : ''}`}
              onClick={() => setSortBy('date')}
            >
              Date
            </button>
            <button
              type="button"
              className={`sound-sort-btn ${sortBy === 'year' ? 'active' : ''}`}
              onClick={() => setSortBy('year')}
            >
              Year
            </button>
            <button
              type="button"
              className={`sound-sort-btn ${sortBy === 'category' ? 'active' : ''}`}
              onClick={() => setSortBy('category')}
            >
              Category
            </button>
          </div>
          <span className="sound-track-header-duration">Time</span>
          <span className="sound-track-header-waveform" aria-hidden />
        </div>
        <ul className="sound-analysis-list">
          {keys.map((key) => (
            <section key={key} className="sound-year-group">
              {keys.length > 1 && <h2 className="sound-year-label">{key}</h2>}
              {grouped[key].map((item) => (
                <SoundTrackRow key={item.id} item={item} index={allItems.indexOf(item)} />
              ))}
            </section>
          ))}
        </ul>
      </div>
    </div>
  )
}
