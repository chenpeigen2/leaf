import * as THREE from 'three'
import { mulberry32 } from './ginkgo'

export interface BranchSegment {
  start: THREE.Vector3
  end: THREE.Vector3
  radius: number
  level: number
}

export interface LeafSlot {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: number
  color: THREE.Color
}

export interface TreeData {
  branches: BranchSegment[]
  leaves: LeafSlot[]
  height: number
  radius: number
}

const GOLD = ['#fff2a8', '#ffe27a', '#fff6c6', '#ffd45e', '#ffeb96', '#f9c74f']
const YOUNG = ['#e2e07a', '#cdd163', '#ece77e']

/**
 * Procedural ginkgo: a vase shaped crown grown from a gently leaning trunk.
 * Everything is deterministic so the tree you fall in love with is always the same tree.
 */
export function generateTree(seed = 20241012, leafTarget = 2600): TreeData {
  const rnd = mulberry32(seed)
  const branches: BranchSegment[] = []
  const leaves: LeafSlot[] = []
  const up = new THREE.Vector3(0, 1, 0)

  const trunkPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.05, 1.7, 0.02),
    new THREE.Vector3(-0.03, 3.3, 0.09),
    new THREE.Vector3(0.06, 4.7, 0.0),
  ]
  const trunkRadii = [0.4, 0.31, 0.22, 0.14]

  for (let i = 0; i < trunkPoints.length - 1; i++) {
    branches.push({
      start: trunkPoints[i].clone(),
      end: trunkPoints[i + 1].clone(),
      radius: trunkRadii[i],
      level: 0,
    })
  }

  const grow = (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    radius: number,
    level: number,
    depth: number,
  ) => {
    const end = origin.clone().addScaledVector(dir, length)
    branches.push({ start: origin.clone(), end, radius, level })

    if (level >= 1) {
      const count = level === 1 ? 10 + Math.floor(rnd() * 7) : 7 + Math.floor(rnd() * 6)
      for (let i = 0; i < count; i++) {
        const t = 0.32 + rnd() * 0.66
        const p = origin.clone().lerp(end, t)
        p.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.26))
        const quaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2),
        )
        const young = rnd() < 0.08
        const color = new THREE.Color(young ? YOUNG[Math.floor(rnd() * YOUNG.length)] : GOLD[Math.floor(rnd() * GOLD.length)])
        color.offsetHSL(0, 0, (rnd() - 0.5) * 0.08)
        leaves.push({
          position: p,
          quaternion,
          scale: 0.17 + rnd() * 0.13,
          color,
        })
      }
    }

    if (depth <= 0) return

    const childCount = rnd() < 0.35 ? 3 : 2
    for (let i = 0; i < childCount; i++) {
      const axis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)
      if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
      axis.normalize()
      const angle = 0.36 + rnd() * 0.46 + i * 0.1
      const childDir = dir.clone().applyAxisAngle(axis, angle)
      childDir.lerp(up, 0.2).normalize()
      grow(
        end,
        childDir,
        length * (0.64 + rnd() * 0.1),
        radius * 0.62,
        level + 1,
        depth - 1,
      )
    }
  }

  // main limbs springing from the upper trunk
  const limbCount = 5
  for (let i = 0; i < limbCount; i++) {
    const base = trunkPoints[i === 2 ? 2 : 3].clone()
    const around = (i / limbCount) * Math.PI * 2 + rnd() * 0.5
    const tilt = 0.36 + rnd() * 0.22
    const dir = new THREE.Vector3(
      Math.sin(around) * Math.sin(tilt),
      Math.cos(tilt),
      Math.cos(around) * Math.sin(tilt),
    ).normalize()
    grow(base, dir, 1.45 + rnd() * 0.45, 0.13, 1, 6)
  }

  // thin the canopy to the requested budget, keeping the silhouette random but stable
  let finalLeaves = leaves
  if (leaves.length > leafTarget) {
    finalLeaves = []
    const step = leaves.length / leafTarget
    for (let i = 0; i < leafTarget; i++) {
      finalLeaves.push(leaves[Math.floor(i * step + rnd() * step)])
    }
  }

  let height = 0
  let radius = 0
  for (const b of branches) {
    height = Math.max(height, b.end.y)
    radius = Math.max(radius, Math.hypot(b.end.x, b.end.z))
  }

  return { branches, leaves: finalLeaves, height, radius }
}

/** Merge every branch into a single draw call. */
export function buildBranchGeometry(branches: BranchSegment[]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0)
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()

  for (const branch of branches) {
    const direction = branch.end.clone().sub(branch.start)
    const length = direction.length()
    if (length < 1e-4) continue
    direction.normalize()
    const geo = new THREE.CylinderGeometry(branch.radius * 0.62, branch.radius, length, 6, 1, true)
    quaternion.setFromUnitVectors(up, direction)
    matrix.compose(branch.start.clone().addScaledVector(direction, length * 0.5), quaternion, new THREE.Vector3(1, 1, 1))
    geo.applyMatrix4(matrix)
    parts.push(geo)
  }

  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  if (!merged) return new THREE.BufferGeometry()

  // vertical gradient baked into vertex colours: darker and wetter at the roots
  const count = merged.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  const base = new THREE.Color('#6e5942')
  const top = new THREE.Color('#b1906a')
  for (let i = 0; i < count; i++) {
    const y = merged.getAttribute('position').getY(i)
    const t = THREE.MathUtils.clamp(y / 6, 0, 1)
    const c = base.clone().lerp(top, t * 0.85)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  merged.computeBoundingSphere()
  return merged
}

/** Small local merge helper (avoids pulling in the examples bundle). */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null
  let vertexCount = 0
  let indexCount = 0
  for (const geo of geometries) {
    vertexCount += geo.getAttribute('position').count
    indexCount += geo.getIndex() ? geo.getIndex()!.count : geo.getAttribute('position').count
  }

  const position = new Float32Array(vertexCount * 3)
  const normal = new Float32Array(vertexCount * 3)
  const uv = new Float32Array(vertexCount * 2)
  const index = new Uint32Array(indexCount)

  let vOffset = 0
  let iOffset = 0
  for (const geo of geometries) {
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    const tex = geo.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) {
      position[(vOffset + i) * 3] = pos.getX(i)
      position[(vOffset + i) * 3 + 1] = pos.getY(i)
      position[(vOffset + i) * 3 + 2] = pos.getZ(i)
      if (nor) {
        normal[(vOffset + i) * 3] = nor.getX(i)
        normal[(vOffset + i) * 3 + 1] = nor.getY(i)
        normal[(vOffset + i) * 3 + 2] = nor.getZ(i)
      }
      if (tex) {
        uv[(vOffset + i) * 2] = tex.getX(i)
        uv[(vOffset + i) * 2 + 1] = tex.getY(i)
      }
    }
    const idx = geo.getIndex()
    if (idx) {
      for (let i = 0; i < idx.count; i++) index[iOffset + i] = idx.getX(i) + vOffset
      iOffset += idx.count
    } else {
      for (let i = 0; i < pos.count; i++) index[iOffset + i] = i + vOffset
      iOffset += pos.count
    }
    vOffset += pos.count
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  merged.setIndex(new THREE.BufferAttribute(index, 1))
  return merged
}
