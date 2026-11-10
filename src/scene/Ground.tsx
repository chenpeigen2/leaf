import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createGroundTexture, createGinkgoLeafGeometry, mulberry32 } from '../lib/ginkgo'
import { createLeafMaterial } from '../lib/leafMaterial'

interface GroundProps {
  leafCount: number
}

/** Cheap value noise, enough to roll the far ground into soft hills. */
function terrainHeight(x: number, z: number) {
  const a = Math.sin(x * 0.07) * Math.cos(z * 0.055) * 0.9
  const b = Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4) * 1.8
  const c = Math.sin((x + z) * 0.13) * 0.18
  return a + b + c
}

export function Ground({ leafCount }: GroundProps) {
  const texture = useMemo(() => createGroundTexture(), [])
  const leafGeometry = useMemo(() => createGinkgoLeafGeometry(20), [])
  const leafMaterial = useMemo(
    () =>
      createLeafMaterial({
        map: texture,
        wind: false,
        vortex: false,
        transmission: 0.22,
        roughness: 0.92,
      }),
    [texture],
  )

  const groundGeometry = useMemo(() => {
    const geometry = new THREE.CircleGeometry(120, 160)
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const radius = Math.hypot(x, y)
      // perfectly flat under the tree, rolling towards the horizon
      const fade = THREE.MathUtils.smoothstep(radius, 14, 90)
      position.setZ(i, terrainHeight(x, y) * fade)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [])

  const meshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const rnd = mulberry32(9182)
    const dummy = new THREE.Object3D()
    const palette = ['#e0a83a', '#c98b2c', '#f0cd74', '#a9681f', '#d8b24f', '#b5761f']
    const color = new THREE.Color()

    for (let i = 0; i < leafCount; i++) {
      // denser close to the trunk, thinning outwards
      const radius = Math.pow(rnd(), 0.62) * 9.5
      const angle = rnd() * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      dummy.position.set(x, 0.012 + rnd() * 0.05, z)
      dummy.rotation.set((rnd() - 0.5) * 0.28, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.28)
      const scale = 0.12 + rnd() * 0.09
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      color.set(palette[Math.floor(rnd() * palette.length)])
      color.offsetHSL(0, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.08)
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [leafCount])

  return (
    <group>
      <mesh geometry={groundGeometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial map={texture} roughness={1} metalness={0} color="#9a9a9a" />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[leafGeometry, leafMaterial, leafCount]}
        receiveShadow
        castShadow={false}
      />
    </group>
  )
}
