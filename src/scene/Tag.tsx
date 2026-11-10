import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { createTagTexture } from '../lib/ginkgo'
import { wind } from '../lib/wind'

interface TagProps {
  visible: boolean
  name: string
  message: string
}

export function Tag({ visible, name, message }: TagProps) {
  const texture = useMemo(() => createTagTexture(name, message), [name, message])
  const pivotRef = useRef<THREE.Group>(null)
  const dropRef = useRef<THREE.Group>(null)
  const drop = useRef(0)

  useEffect(() => {
    if (visible) drop.current = 0
  }, [visible, name, message])

  useFrame((state, delta) => {
    if (!visible) return
    const t = wind.time
    const pivot = pivotRef.current
    if (pivot) {
      pivot.rotation.z = Math.sin(t * 0.9) * 0.055 + Math.sin(t * 2.3 + 1.1) * 0.014
      pivot.rotation.x = Math.sin(t * 0.72 + 0.6) * 0.03
    }

    // the tag is lowered onto the branch when the wish arrives
    drop.current = Math.min(1, drop.current + delta * 0.65)
    const group = dropRef.current
    if (group) {
      const e = 1 - Math.pow(1 - drop.current, 3)
      group.position.y = 0.9 + (1 - e) * 1.6
      group.rotation.y = (1 - e) * 0.5
      const s = 0.86 + e * 0.14
      group.scale.setScalar(s)
    }
    void state
  })

  return (
    <group visible={visible} position={[1.05, 2.5, 1.05]} rotation={[0.03, 0.6, 0]}>
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 2.0, 6]} />
        <meshStandardMaterial color="#6b5236" roughness={0.9} />
      </mesh>
      <group ref={dropRef} position={[0, 2.5, 0]}>
        <group ref={pivotRef} position={[0, 0.9, 0]}>
          <RoundedBox args={[1.2, 1.65, 0.09]} radius={0.055} smoothness={3} position={[0, -0.72, 0]} castShadow>
            <meshStandardMaterial
              map={texture}
              roughness={0.85}
              metalness={0}
              emissive="#4a2d0e"
              emissiveIntensity={0.45}
            />
          </RoundedBox>
          {/* the little hole the string goes through */}
          <mesh position={[0, 0.05, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
            <meshStandardMaterial color="#2a1a0a" roughness={1} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
