import { useEffect, useState } from 'react'
import { imgSrc, gifSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { EXERCISE_MEDIA_ENABLED } from '../lib/forge.js'

const FORGE_MEDIA_BOOT_KEY = 'forge_media_boot_v1'

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom exercises have no media — the animation stays blank by design (issue #11).
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12). Settings can also turn workout media off entirely
// (gifSize 'off') — then nothing renders here and the exercise card closes up, exactly like
// a custom exercise without media. Any other/legacy value behaves as 'full'.
export default function Media({ ex, id, compact, minimizable }) {
  const [playing, setPlaying] = useState(true)
  // 'gif' → the animation failed, the still is showing; 'all' → the still failed too. Media is
  // fetched from wherever the build points (a mount, a CDN): a dropped connection, an expired
  // session on a gated instance or a CDN hiccup used to leave the browser's broken-image glyph
  // on a white block. Now the still stands in for the animation, a neutral tile stands in for
  // both, and a tap tries again — no text, so nothing new to translate.
  const [failed, setFailed] = useState(null)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)

  // Forge previously defaulted media to off while third-party rights were being reviewed.
  // For this testing phase, enable the full workout animation once per browser so an existing
  // saved profile does not silently keep the old Forge default. After this one-time migration,
  // the user's own Full / Mini / Off choice is respected normally.
  useEffect(() => {
    if (!EXERCISE_MEDIA_ENABLED || !minimizable || gifSize !== 'off') return
    try {
      if (localStorage.getItem(FORGE_MEDIA_BOOT_KEY) === '1') return
      localStorage.setItem(FORGE_MEDIA_BOOT_KEY, '1')
      update(s => { s.gifSize = 'full' })
    } catch { /* storage unavailable: leave the saved preference untouched */ }
  }, [gifSize, minimizable, update])

  if (!EXERCISE_MEDIA_ENABLED || !ex.gif) return null
  if (minimizable && gifSize === 'off') return null
  const mini = minimizable && gifSize === 'mini'
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  const showGif = playing && failed == null
  const onError = () => setFailed(showGif ? 'gif' : 'all')
  const onTap = () => {
    if (failed) { setFailed(null); setPlaying(true); return }
    setPlaying(p => !p)
  }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '') + (failed === 'all' ? ' broken' : '')} id={id} onClick={onTap}>
      {failed === 'all'
        ? <div className="exmedia-x"><Icon name="dumbbell" /></div>
        : <img decoding="async" draggable={false} src={showGif ? gifSrc(ex) : imgSrc(ex)} alt={exerciseNameFor(ex)} onError={onError} />}
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && !failed && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  if (!EXERCISE_MEDIA_ENABLED || !ex.img) return <div className="thumb thumb-x"><Icon name="dumbbell" /></div>
  return <img className="thumb" loading="lazy" decoding="async" draggable={false} src={imgSrc(ex)} alt="" />
}
