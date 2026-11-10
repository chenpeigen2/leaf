import * as THREE from 'three'

/** Deterministic PRNG so every visit renders the exact same tree. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A ginkgo leaf: a fan that opens from a single petiole, with the characteristic
 * central cleft and a gentle backward curl.
 */
export function createGinkgoLeafGeometry(segments = 26, notch = 0.32, curl = 0.24): THREE.BufferGeometry {
  const R = 1
  const spread = 1.16 // half angle of the fan, in radians
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  // petiole root
  positions.push(0, 0.02, 0)
  uvs.push(0.5, 0)

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const theta = (t * 2 - 1) * spread
    const cleft = 1 - notch * Math.exp(-Math.pow(theta / 0.2, 2))
    const edge = 1 + 0.04 * Math.cos(theta * 7)
    const r = cleft * edge
    const x = Math.sin(theta) * r * R
    const y = Math.cos(theta) * r * R
    const z = -curl * (x * x * 0.75 + y * y * 0.55) + 0.05 * Math.sin(theta * 3) * y
    positions.push(x, y, z)
    uvs.push(t, 1)
  }

  for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1)

  // petiole (the little stalk)
  const p = positions.length / 3
  positions.push(-0.014, 0.02, 0.008, 0.014, 0.02, 0.008, 0.012, -0.34, 0.004, -0.012, -0.34, 0.004)
  uvs.push(0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0)
  indices.push(p, p + 1, p + 2, p, p + 2, p + 3)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Radiating veins, painted once and reused by every leaf instance. */
export function createLeafTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // soft warmth towards the rim
  const rim = ctx.createLinearGradient(0, size, 0, 0)
  rim.addColorStop(0, 'rgba(255,255,255,1)')
  rim.addColorStop(0.65, 'rgba(252,247,232,1)')
  rim.addColorStop(1, 'rgba(244,232,200,1)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)

  // radiating veins
  ctx.lineCap = 'round'
  for (let i = 0; i <= 26; i++) {
    const x = (i / 26) * size
    ctx.strokeStyle = `rgba(150,112,58,${0.10 + (i % 2 === 0 ? 0.1 : 0)})`
    ctx.lineWidth = i % 2 === 0 ? 2.2 : 1.1
    ctx.beginPath()
    ctx.moveTo(size * 0.5 + (x - size * 0.5) * 0.06, size)
    ctx.lineTo(x, 0)
    ctx.stroke()
  }

  // a few darker blotches so no two leaves read identically
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 2 + Math.random() * 12
    ctx.fillStyle = `rgba(176,132,66,${0.03 + Math.random() * 0.06})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Warm earth with a carpet of fallen leaves painted straight into the texture. */
export function createGroundTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const base = ctx.createLinearGradient(0, 0, size, size)
  base.addColorStop(0, '#8a6538')
  base.addColorStop(0.5, '#6d4d2b')
  base.addColorStop(1, '#52381f')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  const rnd = mulberry32(4242)
  const palette = ['#d9a336', '#e8c05a', '#c98b2c', '#b5761f', '#f0d489', '#a9681f', '#caa64a']
  for (let i = 0; i < 520; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const scale = 12 + rnd() * 30
    const rot = rnd() * Math.PI * 2
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.globalAlpha = 0.35 + rnd() * 0.5
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)]
    ctx.beginPath()
    // fan-shaped blob
    ctx.moveTo(0, 0)
    const spread = 1.1
    const notch = 0.3
    for (let k = 0; k <= 12; k++) {
      const t = k / 12
      const theta = (t * 2 - 1) * spread
      const r = (1 - notch * Math.exp(-Math.pow(theta / 0.2, 2))) * scale
      ctx.lineTo(Math.sin(theta) * r, -Math.cos(theta) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // soil speckle
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size
    const y = rnd() * size
    ctx.fillStyle = `rgba(${40 + rnd() * 60},${28 + rnd() * 40},${16 + rnd() * 26},${0.05 + rnd() * 0.18})`
    ctx.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 3)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(20, 20)
  texture.anisotropy = 8
  return texture
}

/** Bark for the trunk and branches: long vertical striations and a few knots. */
export function createBarkTexture(): THREE.CanvasTexture {
  const w = 256
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const rnd = mulberry32(3131)

  ctx.fillStyle = '#a58d70'
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 150; i++) {
    const x = rnd() * w
    const width = 1 + rnd() * 5
    const shade = 62 + Math.floor(rnd() * 70)
    ctx.strokeStyle = `rgba(${shade},${Math.floor(shade * 0.82)},${Math.floor(shade * 0.62)},${0.18 + rnd() * 0.34})`
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, -10)
    let y = 0
    let px = x
    while (y < h + 10) {
      y += 24 + rnd() * 40
      px += (rnd() - 0.5) * 9
      ctx.lineTo(px, y)
    }
    ctx.stroke()
  }

  for (let i = 0; i < 26; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const r = 5 + rnd() * 16
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, 'rgba(92,70,48,0.7)')
    gradient.addColorStop(0.7, 'rgba(126,104,78,0.4)')
    gradient.addColorStop(1, 'rgba(150,128,98,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 1.6, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2.5, 1)
  texture.anisotropy = 8
  return texture
}

/** Soft round glow used for sun haze and dust motes. */
export function createGlowTexture(inner = 'rgba(255,238,196,1)', outer = 'rgba(255,214,140,0)'): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, inner)
  gradient.addColorStop(0.35, 'rgba(255,226,160,0.55)')
  gradient.addColorStop(1, outer)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Text painted onto a wooden tag hanging from the tree. */
export function createTagTexture(name: string, message: string): THREE.CanvasTexture {
  const w = 640
  const h = 900
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const wood = ctx.createLinearGradient(0, 0, w, h)
  wood.addColorStop(0, '#8a6034')
  wood.addColorStop(0.5, '#6f4a26')
  wood.addColorStop(1, '#54351b')
  ctx.fillStyle = wood
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(40,24,10,${0.05 + Math.random() * 0.12})`
    ctx.lineWidth = 1 + Math.random() * 3
    ctx.beginPath()
    const y = Math.random() * h
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(w * 0.3, y + 18, w * 0.7, y - 18, w, y)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,224,170,0.5)'
  ctx.lineWidth = 3
  ctx.strokeRect(28, 28, w - 56, h - 56)
  ctx.strokeStyle = 'rgba(255,224,170,0.2)'
  ctx.lineWidth = 1
  ctx.strokeRect(40, 40, w - 80, h - 80)

  // Vertical Chinese, right to left: even when the tag is small on a phone,
  // a few large characters still read.
  const serif = '"Songti SC", "STSong", "SimSun", serif'
  const column = (text: string, x: number, y: number, size: number, gap: number, color: string, weight = 400) => {
    ctx.fillStyle = color
    ctx.font = `${weight} ${size}px ${serif}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    Array.from(text).forEach((ch, i) => ctx.fillText(ch, x, y + i * gap))
  }

  let x = w - 96
  const heading = name ? `给${name}` : '给你'
  column(heading, x, 128, 56, 62, 'rgba(255,232,190,0.9)', 600)
  x -= 86

  const chars = Array.from(message || '今天的银杏很黄，想和你一起捡一片。')
  const perColumn = 9
  const columns: string[] = []
  for (let i = 0; i < chars.length; i += perColumn) {
    columns.push(chars.slice(i, i + perColumn).join(''))
  }
  columns.slice(0, 5).forEach((text, index) => {
    column(text, x - index * 82, 132, 54, 74, 'rgba(255,246,226,0.96)', 500)
  })

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,228,180,0.55)'
  ctx.font = `400 26px ${serif}`
  ctx.fillText('银杏树', 62, h - 62)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
