import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createGinkgoLeafGeometry, createLeafTexture, mulberry32 } from '../lib/ginkgo'
import { createLeafMaterial } from '../lib/leafMaterial'
import { wind } from '../lib/wind'
import { sceneState } from '../lib/sceneState'

interface FallingLeaf {
  position: THREE.Vector3
  rotation: THREE.Euler
  spin: number
  fallSpeed: number
  drift: number
  scale: number
  phase: number
  flutter: number
  age: number
}

interface FallingLeavesProps {
  count: number
}

export function FallingLeaves({ count }: FallingLeavesProps) {
  const texture = useMemo(() => createLeafTexture(), [])
  const geometry = useMemo(() => createGinkgoLeafGeometry(18), [])
  const material = useMemo(
    () =>
      createLeafMaterial({
        map: texture,
        wind: false,
        vortex: true,
        transmission: 0.7,
        roughness: 0.68,
      }),
    [texture],
  )

  const meshRef = useRef<THREE.InstancedMesh>(null)
  const leavesRef = useRef<FallingLeaf[]>([])
  const lastShowerId = useRef(sceneState.showerId)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const spawn = (leaf: FallingLeaf, rnd: () => number, around?: THREE.Vector3) => {
    const angle = rnd() * Math.PI * 2
    const radius = Math.sqrt(rnd()) * 4.4
    leaf.position.set(
      (around?.x ?? 0) + Math.cos(angle) * radius,
      around ? around.y + rnd() * 0.6 : 4.1 + rnd() * 4.2,
      (around?.z ?? 0) + Math.sin(angle) * radius,
    )
    leaf.rotation.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2)
    leaf.spin = (rnd() - 0.5) * 1.5
    leaf.fallSpeed = 0.75 + rnd() * 1.25
    leaf.drift = 0.2 + rnd() * 0.95
    leaf.scale = 0.12 + rnd() * 0.09
    leaf.phase = rnd() * Math.PI * 2
    leaf.flutter = 1.1 + rnd() * 1.5
    leaf.age = 0
  }

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const rnd = mulberry32(31337)
    const leaves: FallingLeaf[] = []
    const palette = ['#ffe89a', '#ffd166', '#fff3c4', '#f6b843', '#ffd97e']
    const color = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const leaf: FallingLeaf = {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        spin: 0,
        fallSpeed: 1,
        drift: 1,
        scale: 0.2,
        phase: 0,
        flutter: 1,
        age: 0,
      }
      spawn(leaf, rnd)
      leaves.push(leaf)
      dummy.position.copy(leaf.position)
      dummy.rotation.copy(leaf.rotation)
      dummy.scale.setScalar(leaf.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(palette[Math.floor(rnd() * palette.length)])
      color.offsetHSL(0, 0, (rnd() - 0.5) * 0.08)
      mesh.setColorAt(i, color)
    }
    leavesRef.current = leaves
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count, dummy])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const leaves = leavesRef.current
    if (!mesh || leaves.length === 0) return
    const dt = Math.min(delta, 0.05)
    const t = wind.time

    // a tap on the canopy makes a whole handful of leaves let go at once
    if (sceneState.showerId !== lastShowerId.current) {
      lastShowerId.current = sceneState.showerId
      const rnd = mulberry32(sceneState.showerId * 7919 + 13)
      for (let i = 0; i < Math.min(74, leaves.length); i++) {
        const leaf = leaves[Math.floor(rnd() * leaves.length)]
        const angle = rnd() * Math.PI * 2
        const radius = rnd() * 1.9
        leaf.position.set(
          sceneState.showerPoint.x + Math.cos(angle) * radius,
          sceneState.showerPoint.y + rnd() * 0.9,
          sceneState.showerPoint.z + Math.sin(angle) * radius,
        )
        leaf.fallSpeed = 1.15 + rnd() * 1.15
      }
    }

    const drift = wind.speed
    const pointerRadius = 3.6
    const pointerStrength = wind.pointerStrength

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]

      // aerodynamics: the leaf glides sideways and tumbles about its stem
      const flutter = Math.sin(t * leaf.flutter + leaf.phase)
      leaf.age += dt
      leaf.position.y -= leaf.fallSpeed * dt * (1 + wind.gust * 0.3)
      leaf.position.x += (drift * leaf.drift + flutter * 0.45) * dt
      leaf.position.z += (Math.cos(t * 0.85 + leaf.phase) * 0.28 + 0.08) * dt
      leaf.rotation.y += leaf.spin * dt + flutter * 0.35 * dt
      leaf.rotation.x = flutter * 0.55 + Math.sin(t * 0.6 + leaf.phase) * 0.25
      leaf.rotation.z = Math.cos(t * leaf.flutter * 0.9 + leaf.phase) * 0.9

      // the cursor nudges the falling leaves as well
      if (pointerStrength > 0.01) {
        const dx = leaf.position.x - wind.pointer.x
        const dy = leaf.position.y - wind.pointer.y
        const dz = leaf.position.z - wind.pointer.z
        const distance = Math.hypot(dx, dy, dz)
        if (distance < pointerRadius) {
          const push = pointerStrength * (1 - distance / pointerRadius)
          leaf.position.x += (dx / (distance + 0.001)) * push * 2.4 * dt
          leaf.position.y += (dy / (distance + 0.001)) * push * 2.4 * dt
          leaf.position.z += (dz / (distance + 0.001)) * push * 2.4 * dt
        }
      }

      if (leaf.position.y < 0.03 || Math.hypot(leaf.position.x, leaf.position.z) > 8.5) {
        spawn(leaf, Math.random, undefined)
      }

      dummy.position.copy(leaf.position)
      dummy.rotation.copy(leaf.rotation)
      // leaves fade in as they leave the branch and fade out as they touch down
      const appear = Math.min(1, leaf.age / 0.4)
      const land = Math.min(1, leaf.position.y / 0.6)
      dummy.scale.setScalar(leaf.scale * appear * Math.max(0, land))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} castShadow frustumCulled={false} />
}
