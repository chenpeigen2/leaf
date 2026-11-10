import * as THREE from 'three'

/** Shared between the DOM layer and the 3D layer without triggering React re-renders. */
export const sceneState = {
  /** increments whenever the visitor submits a wish */
  burstId: 0,
  /** increments whenever the visitor taps the canopy */
  showerId: 0,
  showerPoint: new THREE.Vector3(0, 5, 0),
}
