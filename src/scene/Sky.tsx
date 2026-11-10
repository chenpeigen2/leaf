import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { wind } from '../lib/wind'

export const SUN_DIRECTION = new THREE.Vector3(-0.74, 0.25, -0.63).normalize()
export const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(48)

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.38, h));
    color = mix(uGround, color, smoothstep(-0.28, 0.02, h));

    float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
    float disc = pow(sunDot, 380.0);
    float halo = pow(sunDot, 22.0);
    float wide = pow(sunDot, 3.0);
    color += uSunColor * disc * 9.0;
    color += uSunColor * halo * 0.42;
    color += uSunColor * wide * 0.05;

    // slow, thin autumn clouds
    if (h > 0.015) {
      vec2 cloudUv = dir.xz / max(h, 0.06);
      float drift = uTime * 0.004;
      float clouds = fbm(cloudUv * 0.16 + vec2(drift, drift * 0.4));
      clouds = smoothstep(0.46, 0.82, clouds) * smoothstep(0.015, 0.2, h);
      float lit = pow(sunDot, 3.0);
      vec3 cloudColor = mix(vec3(0.93, 0.86, 0.84), vec3(1.0, 0.93, 0.82), lit);
      cloudColor += uSunColor * lit * 0.5;
      color = mix(color, cloudColor, clouds * 0.55);
    }

    // dither away the banding
    color += (hash(gl_FragCoord.xy) - 0.5) * 0.012;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

export function Sky() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color('#4f88c6') },
          uHorizon: { value: new THREE.Color('#ffe7bd') },
          uGround: { value: new THREE.Color('#a87f4f') },
          uSunColor: { value: new THREE.Color('#ffd89a') },
          uSunDirection: { value: SUN_DIRECTION.clone() },
          uTime: { value: 0 },
        },
      }),
    [],
  )

  useFrame(() => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = wind.time
  })

  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[120, 48, 28]} />
    </mesh>
  )
}
