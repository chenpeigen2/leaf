import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, GodRays, HueSaturation, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import type { BloomEffect } from 'postprocessing'
import * as THREE from 'three'
import { sceneState } from '../lib/sceneState'
import { SUN_POSITION } from './Sky'

interface EffectsProps {
  /** cinematic extras: god rays, shallow focus */
  cinematic: boolean
}

export function Effects({ cinematic }: EffectsProps) {
  const bloomRef = useRef<BloomEffect>(null)
  const sunRef = useRef<THREE.Mesh>(null!)
  const lastBurst = useRef(-1)
  const boost = useRef(0)

  useFrame((_, delta) => {
    if (sceneState.burstId !== lastBurst.current) {
      lastBurst.current = sceneState.burstId
      boost.current = 1
    }
    boost.current = Math.max(0, boost.current - delta * 0.32)
    const bloom = bloomRef.current
    if (bloom && typeof bloom.intensity === 'number') {
      bloom.intensity = 0.5 + boost.current * 1.1
    }
  })

  return (
    <>
      {cinematic && (
        <mesh ref={sunRef} position={SUN_POSITION.toArray()} scale={1.6}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#fff3dc" fog={false} toneMapped={false} />
        </mesh>
      )}

      <EffectComposer enableNormalPass={false} multisampling={0} autoClear={false}>
        <Bloom
          ref={bloomRef}
          mipmapBlur
          intensity={0.5}
          luminanceThreshold={0.76}
          luminanceSmoothing={0.24}
          radius={0.68}
        />
        {cinematic && (
          <>
            <GodRays
              sun={sunRef}
              blendFunction={BlendFunction.SCREEN}
              samples={40}
              density={0.96}
              decay={0.93}
              weight={0.26}
              exposure={0.3}
              clampMax={0.95}
              width={320}
              height={320}
              kernelSize={KernelSize.SMALL}
              blur
            />
            <DepthOfField focusDistance={19} focusRange={12} bokehScale={2.2} height={480} />
          </>
        )}
        <HueSaturation saturation={0.08} hue={0} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.16} />
        <Vignette offset={0.24} darkness={0.7} eskil={false} />
      </EffectComposer>
    </>
  )
}
