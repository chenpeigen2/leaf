import * as THREE from 'three'

/**
 * Shared, mutable wind state. Components read it inside useFrame so that a single
 * gust travels through the canopy, the falling leaves and the dust at once.
 */
export const wind = {
  time: 0,
  gust: 0,
  speed: 0,
  /** where the visitor is pointing, in world space */
  pointer: new THREE.Vector3(0, 4, 0),
  /** 0 = nobody there, 1 = the cursor is right in the leaves */
  pointerStrength: 0,
}

export function updateWind(elapsed: number, delta: number) {
  wind.time = elapsed
  const slow = Math.sin(elapsed * 0.17) * 0.5 + Math.sin(elapsed * 0.061 + 1.7) * 0.5
  const gust = Math.pow(Math.max(0, Math.sin(elapsed * 0.23 + 0.6)), 3)
  wind.gust = gust
  wind.speed = 0.35 + slow * 0.45 + gust * 0.9
  void delta
}
