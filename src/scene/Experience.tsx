import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { Sky, SUN_POSITION } from './Sky'
import { Ground } from './Ground'
import { Tree } from './Tree'
import { FallingLeaves } from './FallingLeaves'
import { Motes } from './Motes'
import { LeafSwirl } from './LeafSwirl'
import { LeafField } from './LeafField'
import { Tag } from './Tag'
import { Effects } from './Effects'

export interface QualitySettings {
  treeLeaves: number
  groundLeaves: number
  fallingLeaves: number
  motes: number
  swirlLeaves: number
  shadows: boolean
  cinematic: boolean
  dpr: [number, number]
}

interface ExperienceProps {
  quality: QualitySettings
  immersive: boolean
  onShower: (point: THREE.Vector3) => void
  tag: { visible: boolean; name: string; message: string }
}

/** Keeps the whole tree in frame on a phone as well as on a desktop. */
function ResponsiveCamera() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)

  useEffect(() => {
    const portrait = width / height < 0.9
    const targetY = portrait ? 5.4 : 4.4
    const distance = portrait ? 24 : 19.2
    const direction = new THREE.Vector3(10.9, 1.0, 15.8).normalize()
    camera.position.set(0, targetY, 0).addScaledVector(direction, distance)
    camera.fov = portrait ? 38 : 36
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, targetY, 0)
      controls.update()
    }
  }, [width, height, camera, controls])

  return null
}

/** Keeps the picture smooth on weaker machines by dropping the pixel ratio. */
function AdaptiveQuality() {
  const setDpr = useThree((state) => state.setDpr)
  const ceiling = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  return (
    <PerformanceMonitor
      factor={1}
      onIncline={() => setDpr(ceiling)}
      onDecline={() => setDpr(Math.min(1, ceiling))}
      onFallback={() => setDpr(1)}
    />
  )
}

export function Experience({ quality, immersive, onShower, tag }: ExperienceProps) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = immersive ? 1.1 : 1.04
  }, [gl, immersive])

  return (
    <>
      <fogExp2 attach="fog" args={['#e8cfa4', 0.0105]} />
      <Sky />

      <hemisphereLight args={['#d6e6fb', '#9a7040', 1.25]} />
      <ambientLight color="#ffe2bd" intensity={0.3} />
      <directionalLight
        position={SUN_POSITION}
        color="#fff0d2"
        intensity={3.1}
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadows ? 2048 : 512}
        shadow-mapSize-height={quality.shadows ? 2048 : 512}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={18}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0008}
        shadow-normalBias={0.025}
      />
      {/* warm bounce from the ground, keeps the shadow side readable */}
      <pointLight position={[5.2, 1.4, 6.4]} color="#ffb066" intensity={7} distance={18} decay={2} />
      <pointLight position={[-4.8, 2.6, 3.2]} color="#ffc98a" intensity={4} distance={16} decay={2} />
      {/* a small warm light that keeps the love note readable under the tree */}
      <pointLight position={[1.6, 2.9, 2.6]} color="#ffdcae" intensity={3.4} distance={7} decay={2} />

      <Ground leafCount={quality.groundLeaves} />
      <Tree leafCount={quality.treeLeaves} onShower={onShower} />
      <FallingLeaves count={quality.fallingLeaves} />
      <Motes count={quality.motes} />
      <LeafSwirl count={quality.swirlLeaves} />
      <Tag visible={tag.visible} name={tag.name} message={tag.message} />

      <LeafField />
      <ResponsiveCamera />
      <AdaptiveQuality />

      <OrbitControls
        makeDefault
        target={[0, 4.4, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        rotateSpeed={0.45}
        zoomSpeed={0.6}
        minDistance={7}
        maxDistance={36}
        minPolarAngle={0.42}
        maxPolarAngle={1.5}
        autoRotate
        autoRotateSpeed={immersive ? 0.16 : 0.1}
      />

      <Effects cinematic={quality.cinematic} />
    </>
  )
}
