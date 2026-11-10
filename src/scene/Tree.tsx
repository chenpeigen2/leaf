import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createBarkTexture, createGinkgoLeafGeometry, createLeafTexture } from '../lib/ginkgo'
import { createLeafMaterial } from '../lib/leafMaterial'
import { buildBranchGeometry, generateTree } from '../lib/tree'

interface TreeProps {
  leafCount: number
  onShower: (point: THREE.Vector3) => void
}

export function Tree({ leafCount, onShower }: TreeProps) {
  const texture = useMemo(() => createLeafTexture(), [])
  const leafGeometry = useMemo(() => createGinkgoLeafGeometry(), [])
  const leafMaterial = useMemo(
    () =>
      createLeafMaterial({
        map: texture,
        wind: true,
        vortex: true,
        transmission: 0.55,
        roughness: 0.7,
      }),
    [texture],
  )

  const treeData = useMemo(() => generateTree(20241012, leafCount), [leafCount])
  const branchGeometry = useMemo(() => buildBranchGeometry(treeData.branches), [treeData])

  const leafMeshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = leafMeshRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    treeData.leaves.forEach((leaf, i) => {
      dummy.position.copy(leaf.position)
      dummy.quaternion.copy(leaf.quaternion)
      dummy.scale.setScalar(leaf.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, leaf.color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [treeData])

  const branchMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0,
        color: '#ffffff',
        map: createBarkTexture(),
      }),
    [],
  )

  return (
    <group>
      <mesh geometry={branchGeometry} material={branchMaterial} castShadow receiveShadow />
      <instancedMesh
        ref={leafMeshRef}
        args={[leafGeometry, leafMaterial, treeData.leaves.length]}
        castShadow
        receiveShadow
        onPointerDown={(event) => {
          event.stopPropagation()
          onShower(event.point.clone())
        }}
      />
    </group>
  )
}
