import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mulberry32 } from '../lib/ginkgo'
import { wind } from '../lib/wind'

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uGust;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;
    p.x += sin(uTime * 0.32 + s) * 1.3 + uGust * 1.4;
    p.y += sin(uTime * 0.21 + s * 1.7) * 0.9;
    p.z += cos(uTime * 0.27 + s * 2.3) * 1.1;
    vAlpha = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 1.1 + s * 4.0));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.45 + aSeed) * (14.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float falloff = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, falloff * falloff * vAlpha * 0.22);
  }
`

export function Motes({ count = 420 }: { count?: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const rnd = mulberry32(777)
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2
      const radius = 1 + Math.pow(rnd(), 0.7) * 11
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = rnd() * 8.5
      positions[i * 3 + 2] = Math.sin(angle) * radius
      seeds[i] = rnd()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 20)
    return geo
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 10 },
      uGust: { value: 0 },
      uColor: { value: new THREE.Color('#ffdda6') },
    }),
    [],
  )

  useFrame(() => {
    if (!materialRef.current) return
    materialRef.current.uniforms.uTime.value = wind.time
    materialRef.current.uniforms.uGust.value = wind.gust
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
