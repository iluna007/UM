import { useState, useRef, useEffect } from "react"
import CreateSpectrogram from "./CreateSpectrogram"

const WAVEFORM_BARS = 40
const MAX_DURATION_FOR_WAVEFORM = 120

export default function SoundTrackRow({ item, index }) {
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(null)
  const [waveform, setWaveform] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const loadWaveform = async () => {
      try {
        const res = await fetch(item.audioRecording)
        if (!res.ok) return
        const arrayBuffer = await res.arrayBuffer()
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return
        const numChannels = audioBuffer.numberOfChannels
        const ch0 = audioBuffer.getChannelData(0)
        let samples
        if (numChannels > 1) {
          const ch1 = audioBuffer.getChannelData(1)
          samples = new Float32Array(ch0.length)
          for (let i = 0; i < ch0.length; i++) samples[i] = (ch0[i] + ch1[i]) / 2
        } else {
          samples = ch0
        }
        const sampleRate = audioBuffer.sampleRate
        const maxSamples = Math.min(samples.length, MAX_DURATION_FOR_WAVEFORM * sampleRate)
        const samplesTrimmed = samples.slice(0, maxSamples)
        const barCount = WAVEFORM_BARS
        const samplesPerBar = Math.floor(samplesTrimmed.length / barCount) || 1
        const bars = []
        let maxVal = 0
        for (let i = 0; i < barCount; i++) {
          const start = i * samplesPerBar
          const end = Math.min(start + samplesPerBar, samplesTrimmed.length)
          let max = 0
          for (let j = start; j < end; j++) {
            const v = Math.abs(samplesTrimmed[j])
            if (v > max) max = v
          }
          bars.push(max)
          if (max > maxVal) maxVal = max
        }
        if (maxVal > 0) {
          for (let i = 0; i < bars.length; i++) {
            bars[i] = bars[i] / maxVal
          }
        }
        if (!cancelled) setWaveform(bars)
      } catch {
        if (!cancelled) setWaveform(null)
      }
    }
    loadWaveform()
    return () => { cancelled = true }
  }, [item.audioRecording])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const m = Math.floor(audio.duration / 60)
        const s = Math.floor(audio.duration % 60)
        setDuration(m + ":" + s.toString().padStart(2, "0"))
      }
    }
    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    if (audio.readyState >= 1) onLoadedMetadata()
    return () => audio.removeEventListener("loadedmetadata", onLoadedMetadata)
  }, [item.audioRecording])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    return () => {
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
    }
  }, [])

  const handlePlayPause = (e) => {
    e.stopPropagation()
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else audio.play()
  }

  const thumbnail = item.images?.[0]

  return (
    <li className={"sound-track-row " + (expanded ? "expanded " : "") + (playing ? "playing" : "")} onClick={() => setExpanded((prev) => !prev)}>
      <audio ref={audioRef} src={item.audioRecording} preload="metadata" />
      <div className="sound-track-play" onClick={handlePlayPause} aria-label={playing ? "Pause" : "Play"}>
        <span className="sound-track-play-icon">{playing ? '⏸' : '▶'}</span>
      </div>
      <span className="sound-track-num">{index + 1}</span>
      <div className="sound-track-artwork">
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <div className="sound-track-artwork-placeholder" />}
      </div>
      <div className="sound-track-info">
        <span className="sound-track-title">{item.title}</span>
        <span className="sound-track-meta">
        {(Array.isArray(item.category) ? item.category.join(' · ') : item.category)} · {item.date}
      </span>
      </div>
      <span className="sound-track-duration">{duration ?? '—'}</span>
      <div className="sound-track-waveform">
        <div className="sound-track-waveform-bars">
          {waveform
            ? waveform.map((val, i) => (
                <span
                  key={i}
                  className="sound-track-waveform-bar"
                  style={{ height: `${Math.max(8, val * 100)}%` }}
                />
              ))
            : Array.from({ length: WAVEFORM_BARS }, (_, i) => (
                <span key={i} className="sound-track-waveform-bar sound-track-waveform-bar-loading" style={{ height: '20%' }} />
              ))}
        </div>
      </div>
      {expanded && (
        <div className="sound-track-expanded" onClick={(e) => e.stopPropagation()}>
          <CreateSpectrogram item={item} />
        </div>
      )}
    </li>
  )
}
