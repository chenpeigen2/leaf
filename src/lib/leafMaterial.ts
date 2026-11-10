import * as THREE from 'three'

/**
 * One set of uniforms shared by every leaf material in the scene.
 * A single driver keeps them in sync, so the canopy, the falling leaves,
 * the ground litter and the swirl all breathe with the same wind.
 */
export const leafUniforms = {
  uTime: { value: 0 },
  uWind: { value: 0 },
  uPointer: { value: new THREE.Vector3(0, 4, 0) },
  uPointerStrength: { value: 0 },
  uPointerRadius: { value: 3.6 },
  uSunDirection: { value: new THREE.Vector3(-0.74, 0.25, -0.63).normalize() },
  uSunColor: { value: new THREE.Color('#ffd7a0') },
}

export interface LeafMaterialOptions {
  map: THREE.Texture
  /** sway in the wind (canopy leaves) */
  wind?: boolean
  /** swirl around the cursor */
  vortex?: boolean
  /** how much sunlight shines through the blade */
  transmission?: number
  roughness?: number
  emissive?: number
  emissiveIntensity?: number
}

const vertexHeader = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  uniform vec3 uPointer;
  uniform float uPointerStrength;
  uniform float uPointerRadius;
`

const fragmentHeader = /* glsl */ `
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uTransmission;
`

export function createLeafMaterial(options: LeafMaterialOptions): THREE.MeshStandardMaterial {
  const wind = options.wind ?? true
  const vortex = options.vortex ?? true
  const transmission = options.transmission ?? 0

  const material = new THREE.MeshStandardMaterial({
    map: options.map,
    color: '#ffffff',
    roughness: options.roughness ?? 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(options.emissive ?? 0x160c02),
    emissiveIntensity: options.emissiveIntensity ?? 0.35,
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = leafUniforms.uTime
    shader.uniforms.uWind = leafUniforms.uWind
    shader.uniforms.uPointer = leafUniforms.uPointer
    shader.uniforms.uPointerStrength = leafUniforms.uPointerStrength
    shader.uniforms.uPointerRadius = leafUniforms.uPointerRadius
    shader.uniforms.uSunDirection = leafUniforms.uSunDirection
    shader.uniforms.uSunColor = leafUniforms.uSunColor
    shader.uniforms.uTransmission = { value: transmission }

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHeader}`)
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
          #include <begin_vertex>
          ${
            wind
              ? /* glsl */ `
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].x * 3.7 + instanceMatrix[3].z * 2.9 + instanceMatrix[3].y * 1.3;
            float amp = 0.03 + 0.06 * clamp(position.y, 0.0, 1.0);
            transformed.x += (sin(uTime * 1.7 + phase) * 0.7 + uWind * 0.55) * amp;
            transformed.z += cos(uTime * 1.35 + phase * 1.6) * amp * 0.9;
            transformed.y += sin(uTime * 2.4 + phase * 2.1) * amp * 0.3;
          #endif
        `
              : ''
          }
        `,
      )

    if (vortex) {
      // the cursor pushes the leaves aside, right where she points
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        /* glsl */ `
          #include <project_vertex>
          #ifdef USE_INSTANCING
            vec4 leafWorld = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            vec3 toLeaf = leafWorld.xyz - uPointer;
            float pointerDistance = length(toLeaf);
            float pull = uPointerStrength * smoothstep(uPointerRadius, 0.0, pointerDistance);
            vec3 tangent = normalize(vec3(-toLeaf.z, 0.45, toLeaf.x) + vec3(0.0001, 0.0, 0.0001));
            vec3 push = normalize(toLeaf + vec3(0.0001, 0.12, 0.0001));
            mvPosition.xyz += (viewMatrix * vec4(tangent * pull * 0.5 + push * pull * 0.22, 0.0)).xyz;
          #endif
        `,
      )
    }

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHeader}`)
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
          #include <opaque_fragment>
          {
            // sunlight bleeding through the blade
            vec3 sunTravel = normalize((viewMatrix * vec4(-uSunDirection, 0.0)).xyz);
            float backLight = max(dot(normal, sunTravel), 0.0);
            float glow = pow(backLight, 1.7) * uTransmission;
            gl_FragColor.rgb += uSunColor * glow * (0.4 + 0.9 * gl_FragColor.rgb);

            // a faint waxy sheen along the edge of the leaf
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
            gl_FragColor.rgb += vec3(1.0, 0.93, 0.8) * fresnel * 0.07;
          }
        `,
      )
  }

  material.customProgramCacheKey = () => `leaf|${wind}|${vortex}`
  return material
}
