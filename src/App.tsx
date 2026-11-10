import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Experience } from './scene/Experience'
import type { QualitySettings } from './scene/Experience'
import { Overlay } from './ui/Overlay'
import { sceneState } from './lib/sceneState'
import { ambience } from './lib/audio'

const DESKTOP: QualitySettings = {
  treeLeaves: 9000,
  groundLeaves: 1500,
  fallingLeaves: 150,
  motes: 360,
  swirlLeaves: 300,
  shadows: true,
  cinematic: true,
  dpr: [1, 2],
}

const MOBILE: QualitySettings = {
  treeLeaves: 4000,
  groundLeaves: 520,
  fallingLeaves: 70,
  motes: 150,
  swirlLeaves: 170,
  shadows: false,
  cinematic: false,
  dpr: [1, 1.5],
}

function detectQuality(): QualitySettings {
  if (typeof window === 'undefined') return DESKTOP
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const narrow = window.innerWidth < 820
  return coarse || narrow ? MOBILE : DESKTOP
}

/** The wish travels inside the link, so the page TA opens is already the letter. */
function readWishFromUrl(): { name: string; message: string } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const name = params.get('n') ?? ''
  const message = params.get('m') ?? ''
  if (!name && !message) return null
  return { name, message }
}

export default function App() {
  const [quality] = useState<QualitySettings>(detectQuality)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [entered, setEntered] = useState(false)
  const [hintShown, setHintShown] = useState(false)
  // the page opens with nothing but the tree
  const [immersive, setImmersive] = useState(true)
  const stageRef = useRef<HTMLDivElement>(null)

  const handleShower = useCallback((point: THREE.Vector3) => {
    sceneState.showerPoint.copy(point)
    sceneState.showerId += 1
    ambience.rustle(0.7)
  }, [])

  const handleSubmit = useCallback(() => {
    setSubmitted(true)
    setImmersive(true)
    sceneState.burstId += 1
    ambience.chime()
    try {
      const params = new URLSearchParams()
      if (name) params.set('n', name)
      if (message) params.set('m', message)
      const query = params.toString()
      window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname)
    } catch {
      /* private mode, no problem */
    }
  }, [name, message])

  const handleToggleSound = useCallback(() => {
    setSoundOn(ambience.toggle())
  }, [])

  const handleEnterImmersive = useCallback(() => {
    setImmersive(true)
  }, [])

  const handleReveal = useCallback(() => {
    setImmersive(false)
  }, [])

  // opening a shared link plays the whole scene for TA
  useEffect(() => {
    const wish = readWishFromUrl()
    if (!wish) return
    setName(wish.name)
    setMessage(wish.message)
    const timer = window.setTimeout(() => {
      setSubmitted(true)
      sceneState.burstId += 1
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [])

  // the opening line: the tree needs a moment to grow
  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 1500)
    return () => window.clearTimeout(timer)
  }, [])
  // the invitation to write appears only after the scene has settled
  useEffect(() => {
    const timer = window.setTimeout(() => setHintShown(true), 3200)
    return () => window.clearTimeout(timer)
  }, [])

  // the very first tap on the scenery is a valid gesture: let the wind in
  useEffect(() => {
    let done = false
    const firstGesture = (event: Event) => {
      if (done) return
      const target = event.target as HTMLElement | null
      if (target?.closest?.('button')) return
      done = true
      if (!ambience.enabled) setSoundOn(ambience.toggle())
    }
    window.addEventListener('pointerdown', firstGesture)
    window.addEventListener('keydown', firstGesture)
    return () => {
      window.removeEventListener('pointerdown', firstGesture)
      window.removeEventListener('keydown', firstGesture)
    }
  }, [])

  // Esc always returns to the quiet picture
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImmersive(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={stageRef} className={`stage ${immersive ? 'stage--immersive' : ''}`}>
      <Canvas
        shadows={quality.shadows ? 'percentage' : false}
        dpr={quality.dpr}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [11.2, 5.4, 15.8], fov: 36, near: 0.1, far: 400 }}
        onCreated={() => {
          // the curtain lifts as soon as the scene is on screen
          requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
        }}
      >
        <Experience
          quality={quality}
          immersive={immersive}
          onShower={handleShower}
          tag={{ visible: submitted, name, message }}
        />
      </Canvas>

      <div className={`intro ${entered ? 'intro--gone' : ''}`}>
        <h2>银杏寄语</h2>
        <span className="intro-bar" />
        <p>正在种一棵树…</p>
      </div>

      <div className="frame" />

      <Overlay
        className={entered ? 'overlay--visible' : ''}
        immersive={immersive}
        hintShown={hintShown}
        name={name}
        message={message}
        submitted={submitted}
        soundOn={soundOn}
        onNameChange={setName}
        onMessageChange={setMessage}
        onSubmit={handleSubmit}
        onToggleSound={handleToggleSound}
        onToggleImmersive={handleEnterImmersive}
        onReveal={handleReveal}
        onReset={() => setSubmitted(false)}
      />
    </div>
  )
}
