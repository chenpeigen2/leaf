import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { leafUniforms } from '../lib/leafMaterial'
import { updateWind, wind } from '../lib/wind'
import { ambience } from '../lib/audio'

/** The point in the scene the cursor is "touching" (a plane through the canopy). */
const FOCUS = new THREE.Vector3(0, 4.2, 0)

/**
 * The cursor is a physical thing in this scene: leaves lean away from it and the
 * air around it stirs a little.
 */
export function LeafField() {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  const ndc = useRef(new THREE.Vector2())
  const raycaster = useRef(new THREE.Raycaster())
  const plane = useRef(new THREE.Plane())
  const hit = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())
  const last = useRef(new THREE.Vector2())
  const speed = useRef(0)
  const strength = useRef(0)
  const inside = useRef(false)
  const brushCooldown = useRef(0)

  useEffect(() => {
    const element = gl.domElement

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect()
      ndc.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      ndc.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      const dx = event.clientX - last.current.x
      const dy = event.clientY - last.current.y
      last.current.set(event.clientX, event.clientY)
      speed.current = Math.min(1.4, speed.current + Math.hypot(dx, dy) * 0.008)
      inside.current = true
    }

    const onLeave = () => {
      inside.current = false
    }

    element.addEventListener('pointermove', onMove, { passive: true })
    element.addEventListener('pointerdown', onMove, { passive: true })
    element.addEventListener('pointerleave', onLeave, { passive: true })

    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerdown', onMove)
      element.removeEventListener('pointerleave', onLeave)
    }
  }, [gl])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    updateWind(state.clock.getElapsedTime(), dt)

    // where does the cursor point to in the world?
    raycaster.current.setFromCamera(ndc.current, camera)
    camera.getWorldDirection(direction.current)
    plane.current.setFromNormalAndCoplanarPoint(direction.current, FOCUS)
    if (raycaster.current.ray.intersectPlane(plane.current, hit.current)) {
      wind.pointer.lerp(hit.current, 1 - Math.pow(0.0005, dt))
    }

    // a cursor that keeps moving stirs the air
    speed.current *= Math.exp(-dt * 1.15)
    const target = inside.current ? Math.min(1, 0.34 + speed.current * 0.9) : 0
    strength.current += (target - strength.current) * (1 - Math.exp(-dt * 6))
    wind.pointerStrength = strength.current
    wind.gust = Math.min(1.2, wind.gust + speed.current * dt * 2.4)

    leafUniforms.uPointer.value.copy(wind.pointer)
    leafUniforms.uPointerStrength.value = strength.current
    leafUniforms.uWind.value = wind.gust
    leafUniforms.uTime.value = wind.time

    // the air and the leaves follow the visitor
    ambience.setGust(wind.gust)
    brushCooldown.current -= dt
    if (speed.current > 0.45 && brushCooldown.current <= 0) {
      brushCooldown.current = 0.55
      ambience.brush(Math.min(1, speed.current))
    }
  })

  return null
}
