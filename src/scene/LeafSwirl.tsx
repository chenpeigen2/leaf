import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createGinkgoLeafGeometry, createGlowTexture, createLeafTexture, mulberry32 } from '../lib/ginkgo'
import { createLeafMaterial } from '../lib/leafMaterial'
import { sceneState } from '../lib/sceneState'

const CENTER = new THREE.Vector3(5.5, 6.05, 0.5)
/** the spiral leans towards the camera, so it always reads as a shape */
const NORMAL = new THREE.Vector3(-0.54, -0.16, -0.83).normalize()
const AXIS_Z = new THREE.Vector3(0, 0, 1)

interface SwirlLeaf {
  local: THREE.Vector3
  start: THREE.Vector3
  control: THREE.Vector3
  delay: number
  duration: number
  phase: number
  spin: THREE.Vector3
  scale: number
}

export function LeafSwirl({ count = 300 }: { count?: number }) {
  const texture = useMemo(() => createLeafTexture(), [])
  const glowTexture = useMemo(() => createGlowTexture('rgba(255,236,190,1)', 'rgba(255,198,110,0)'), [])
  const geometry = useMemo(() => createGinkgoLeafGeometry(18), [])
  const material = useMemo(
    () =>
      createLeafMaterial({
        map: texture,
        wind: false,
        vortex: true,
        transmission: 0.8,
        roughness: 0.62,
        emissive: 0x3a2408,
        emissiveIntensity: 0.5,
      }),
    [texture],
  )

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const leavesRef = useRef<SwirlLeaf[]>([])
  const lastBurstId = useRef(sceneState.burstId)
  const burstStart = useRef(-100)
  const spin = useRef(0)
  const glowRef = useRef<THREE.Sprite>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const scratch = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const orientation = useMemo(() => new THREE.Quaternion(), [])
  const spinQuaternion = useMemo(() => new THREE.Quaternion(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const rnd = mulberry32(60606)
    leavesRef.current = []
    const palette = ['#fff6cf', '#ffeaa4', '#ffdc7c', '#fff2b8', '#f9cd5c']
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      // two arms of a slow spiral
      const arm = Math.floor(rnd() * 2)
      const t = Math.pow(rnd(), 0.8)
      const theta = (arm / 2) * Math.PI * 2 + t * 2.4 * Math.PI + (rnd() - 0.5) * 0.22
      const radius = (0.24 + t * 2.75) * (0.96 + rnd() * 0.08)
      const local = new THREE.Vector3(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius * 0.56,
        Math.sin(t * Math.PI) * 0.3 + (rnd() - 0.5) * 0.16,
      )

      const angle = rnd() * Math.PI * 2
      const canopyRadius = Math.sqrt(rnd()) * 3.3
      const start = new THREE.Vector3(
        Math.cos(angle) * canopyRadius,
        3.4 + rnd() * 4.4,
        Math.sin(angle) * canopyRadius,
      )

      leavesRef.current.push({
        local,
        start,
        control: start
          .clone()
          .add(new THREE.Vector3((rnd() - 0.5) * 2.8, 1.2 + rnd() * 2.4, (rnd() - 0.5) * 2.8)),
        delay: rnd() * 0.9,
        duration: 1.9 + rnd() * 1.2,
        phase: rnd() * Math.PI * 2,
        spin: new THREE.Vector3((rnd() - 0.5) * 3.2, (rnd() - 0.5) * 3.2, (rnd() - 0.5) * 3.2),
        scale: 0.12 + rnd() * 0.06,
      })

      dummy.position.copy(start)
      dummy.scale.setScalar(0.0001)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(palette[Math.floor(rnd() * palette.length)])
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count, dummy])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const leaves = leavesRef.current
    if (!mesh || leaves.length === 0) return

    if (sceneState.burstId !== lastBurstId.current) {
      lastBurstId.current = sceneState.burstId
      burstStart.current = state.clock.getElapsedTime()
      spin.current = 0
    }

    const elapsed = state.clock.getElapsedTime() - burstStart.current
    spin.current += delta * 0.16
    orientation.setFromUnitVectors(AXIS_Z, NORMAL)
    spinQuaternion.setFromAxisAngle(AXIS_Z, spin.current)

    let alive = 0
    for (let i = 0; i < Math.min(leaves.length, count); i++) {
      const leaf = leaves[i]
      const local = elapsed - leaf.delay

      // where this leaf wants to be right now: the spiral turns very slowly
      target.copy(leaf.local).applyQuaternion(spinQuaternion).applyQuaternion(orientation).add(CENTER)

      if (local < 0) {
        dummy.position.copy(leaf.start)
        dummy.scale.setScalar(0.0001)
        dummy.rotation.set(0, 0, 0)
      } else if (local < leaf.duration) {
        // the leaf is carried up out of the canopy and into the spiral
        const t = local / leaf.duration
        const eased = 1 - Math.pow(1 - t, 2.6)
        const one = 1 - eased
        scratch
          .copy(leaf.start)
          .multiplyScalar(one * one)
          .addScaledVector(leaf.control, 2 * one * eased)
          .addScaledVector(target, eased * eased)
        dummy.position.copy(scratch)
        dummy.rotation.set(
          leaf.phase + leaf.spin.x * eased,
          leaf.phase * 1.3 + leaf.spin.y * eased,
          leaf.phase * 0.7 + leaf.spin.z * eased,
        )
        dummy.scale.setScalar(leaf.scale * Math.min(1, eased * 2.6))
      } else {
        // it holds for a while, then lets go and falls back to the ground
        const after = local - leaf.duration
        const fade = after < 5.5 ? 1 : Math.max(0, 1 - (after - 5.5) / 3.2)
        dummy.position.copy(target)
        dummy.position.y -= after * after * 0.035
        dummy.position.x += Math.sin(leaf.phase + after * 0.8) * 0.07
        dummy.position.z += Math.cos(leaf.phase * 1.4 + after * 0.7) * 0.07
        dummy.rotation.set(
          leaf.phase + leaf.spin.x,
          leaf.phase * 1.3 + leaf.spin.y,
          leaf.phase * 0.7 + leaf.spin.z + after * 0.5,
        )
        dummy.scale.setScalar(leaf.scale * fade)
        if (fade > 0.2) alive += 1
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    // a soft halo of light at the heart of the spiral
    const glow = glowRef.current
    if (glow) {
      const visible = elapsed > 0.4 && elapsed < 10
      const pulse = 0.85 + Math.sin(state.clock.getElapsedTime() * 1.3) * 0.12
      const targetOpacity = visible ? Math.min(0.5, (alive / (count * 0.3)) * pulse) : 0
      const material = glow.material as THREE.SpriteMaterial
      material.opacity += (targetOpacity - material.opacity) * 0.06
      glow.scale.setScalar(4.6 + Math.sin(state.clock.getElapsedTime() * 0.7) * 0.35)
    }
  })

  return (
    <group>
      <instancedMesh ref={meshRef} args={[geometry, material, count]} castShadow frustumCulled={false} />
      <sprite ref={glowRef} position={CENTER.toArray()} scale={[4.6, 4.6, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#ffd98f"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}
