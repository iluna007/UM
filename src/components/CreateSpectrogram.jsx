import { useState, useCallback, useEffect } from 'react'
import SpectrogramCanvas from './SpectrogramCanvas'
import {
  computeSpectrogram,
  computeWelchPSD,
  filterSpectrogram,
} from '../utils/spectrogramUtils'

const MAX_DURATION_SEC = 120

export default function CreateSpectrogram({ item }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = useCallback(async () => {
    const audioUrl = item?.audioRecording
    if (!audioUrl) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch(audioUrl)
      if (!res.ok) throw new Error('Failed to fetch audio')
      const arrayBuffer = await res.arrayBuffer()

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      const sampleRate = audioBuffer.sampleRate
      const numChannels = audioBuffer.numberOfChannels
      const channelData = audioBuffer.getChannelData(0)
      const totalSamples = channelData.length

      let samples = channelData
      if (numChannels > 1) {
        const right = audioBuffer.getChannelData(1)
        samples = new Float32Array(totalSamples)
        for (let i = 0; i < totalSamples; i++) {
          samples[i] = (channelData[i] + right[i]) / 2
        }
      }

      const maxSamples = Math.min(totalSamples, Math.floor(MAX_DURATION_SEC * sampleRate))
      const trimmed = samples.slice(0, maxSamples)

      const specResult = computeSpectrogram(trimmed, sampleRate)
      const psdResult = computeWelchPSD(trimmed, sampleRate)
      const { SxxFiltered, nFiltered, nWindows } = filterSpectrogram(specResult)

      const waveWidth = 810
      const waveLen = trimmed.length
      const waveform = new Array(waveWidth)
      for (let i = 0; i < waveWidth; i++) {
        const start = Math.floor((i / waveWidth) * waveLen)
        const end = Math.floor(((i + 1) / waveWidth) * waveLen)
        let max = 0
        for (let j = start; j < end && j < waveLen; j++) {
          const v = Math.abs(trimmed[j])
          if (v > max) max = v
        }
        waveform[i] = max
      }

      const tStart = 0
      const tEnd = maxSamples / sampleRate

      setData({
        SxxFiltered,
        nFiltered,
        nWindows,
        psd: { f: psdResult.f, psd_db: psdResult.psd_db },
        waveform,
        tStart,
        tEnd,
        audioUrl,
      })
    } catch (err) {
      setError(err.message || 'Error generating spectrogram')
    } finally {
      setLoading(false)
    }
  }, [item])

  useEffect(() => {
    if (item?.audioRecording) handleGenerate()
  }, [item?.audioRecording, handleGenerate])

  if (!item?.audioRecording) return null

  return (
    <div className="create-spectrogram">
      {loading && <p className="create-spectrogram-loading">Generating spectrogram…</p>}
      {error && <p className="create-spectrogram-error">{error}</p>}
      {data && <SpectrogramCanvas data={data} />}
    </div>
  )
}
