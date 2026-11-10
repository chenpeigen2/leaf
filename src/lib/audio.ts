/**
 * Everything you hear is synthesised in the browser: no audio files.
 *
 * Wind is built the way real wind works - a low body of air, a band of hiss,
 * a resonant whistle through the branches, all of them drifting slowly and
 * randomly, and a short outdoor reverb so it sounds like it is outside.
 */

interface WindLayer {
  source: AudioBufferSourceNode
  filter: BiquadFilterNode
  gain: GainNode
  pan: StereoPannerNode
  base: number
}

export class Ambience {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private windBus: GainNode | null = null
  private reverb: ConvolverNode | null = null
  private layers: WindLayer[] = []
  private noise: AudioBuffer | null = null
  private timer: number | null = null
  private gustTimer: number | null = null
  private lastGustUpdate = 0
  private gust = 0
  enabled = false

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0

      // a gentle limiter so nothing ever spikes
      const limiter = this.ctx.createDynamicsCompressor()
      limiter.threshold.value = -16
      limiter.knee.value = 14
      limiter.ratio.value = 3
      limiter.attack.value = 0.01
      limiter.release.value = 0.28
      this.master.connect(limiter).connect(this.ctx.destination)
    }
    return this.ctx
  }

  toggle(): boolean {
    const ctx = this.ensure()
    if (!ctx || !this.master) return false
    if (this.enabled) {
      this.enabled = false
      this.master.gain.cancelScheduledValues(ctx.currentTime)
      this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.35)
      this.stopDrift()
      if (this.gustTimer !== null) {
        window.clearTimeout(this.gustTimer)
        this.gustTimer = null
      }
      return false
    }
    this.enabled = true
    ctx.resume()
    this.startWind()
    this.startDrift()
    this.scheduleGust()
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.9)
    return true
  }

  /** Pink-ish noise (1/f), which is what moving air actually sounds like. */
  private makePink(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let b0 = 0
      let b1 = 0
      let b2 = 0
      let b3 = 0
      let b4 = 0
      let b5 = 0
      let b6 = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
        b6 = white * 0.115926
        data[i] = pink * 0.09
      }
    }
    return buffer
  }

  /** A short outdoor impulse response: sparse early reflections + a soft tail. */
  private makeImpulse(): AudioBuffer {
    const ctx = this.ctx!
    const seconds = 1.9
    const length = Math.floor(ctx.sampleRate * seconds)
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const t = i / length
        const decay = Math.pow(1 - t, 3.4)
        data[i] = (Math.random() * 2 - 1) * decay * 0.5
      }
      const taps: [number, number][] = [
        [0.011, 0.45],
        [0.026, 0.32],
        [0.043, 0.24],
        [0.067, 0.17],
      ]
      for (const [delay, gain] of taps) {
        const index = Math.floor(delay * ctx.sampleRate) + (channel === 1 ? 41 : 0)
        if (index < length) data[index] += gain
      }
    }
    return impulse
  }

  private addLayer(
    buffer: AudioBuffer,
    type: BiquadFilterType,
    frequency: number,
    q: number,
    gainValue: number,
  ): WindLayer {
    const ctx = this.ctx!
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q

    const gain = ctx.createGain()
    gain.gain.value = gainValue

    const pan = ctx.createStereoPanner()
    pan.pan.value = 0

    source.connect(filter).connect(gain).connect(pan).connect(this.windBus!)
    source.start()

    const layer: WindLayer = { source, filter, gain, pan, base: gainValue }
    this.layers.push(layer)
    return layer
  }

  private startWind() {
    const ctx = this.ctx
    if (!ctx || !this.master || this.windBus) return

    this.windBus = ctx.createGain()
    this.windBus.gain.value = 0.9
    this.windBus.connect(this.master)

    // outdoor space
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = this.makeImpulse()
    const wet = ctx.createGain()
    wet.gain.value = 0.34
    this.windBus.connect(this.reverb).connect(wet).connect(this.master)

    // a very slow breath underneath everything: real wind swells and ebbs
    const breath = ctx.createOscillator()
    breath.frequency.value = 0.075
    const breathGain = ctx.createGain()
    breathGain.gain.value = 0.16
    breath.connect(breathGain).connect(this.windBus.gain)
    breath.start()

    this.noise = this.makePink(6)

    // 1. the body of the wind
    this.addLayer(this.noise, 'lowpass', 190, 0.7, 0.55)
    // 2. the air moving through the canopy
    this.addLayer(this.noise, 'bandpass', 1100, 0.7, 0.1)
    // 3. the whistle of the branches
    this.addLayer(this.noise, 'bandpass', 760, 7, 0.0)
    // 4. the dry hiss of leaves
    this.addLayer(this.noise, 'highpass', 4200, 0.5, 0.02)
  }

  /** Every so often a real gust rolls through: a narrow resonance that sweeps up and away. */
  private scheduleGust() {
    if (this.gustTimer !== null) window.clearTimeout(this.gustTimer)
    const next = 5000 + Math.random() * 8000
    this.gustTimer = window.setTimeout(() => {
      if (!this.enabled || !this.ctx || !this.noise || !this.windBus) return
      const ctx = this.ctx
      const now = ctx.currentTime
      const length = 2.6 + Math.random() * 2.2

      const source = ctx.createBufferSource()
      source.buffer = this.noise
      source.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.Q.value = 2.2 + Math.random() * 3
      filter.frequency.setValueAtTime(260 + Math.random() * 180, now)
      filter.frequency.exponentialRampToValueAtTime(900 + Math.random() * 900, now + length * 0.45)
      filter.frequency.exponentialRampToValueAtTime(300 + Math.random() * 200, now + length)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.09 + Math.random() * 0.07, now + length * 0.35)
      gain.gain.linearRampToValueAtTime(0.0001, now + length)

      const pan = ctx.createStereoPanner()
      pan.pan.setValueAtTime(Math.random() * 1.2 - 0.6, now)
      pan.pan.linearRampToValueAtTime(Math.random() * 1.2 - 0.6, now + length)

      source.connect(filter).connect(gain).connect(pan).connect(this.windBus)
      source.start(now)
      source.stop(now + length + 0.1)
      source.onended = () => source.disconnect()

      this.scheduleGust()
    }, next)
  }

  /** The wind never stays the same: every couple of seconds it shifts. */
  private startDrift() {
    const ctx = this.ctx
    if (!ctx) return
    this.stopDrift()
    const drift = () => {
      if (!this.ctx || !this.enabled) return
      const now = this.ctx.currentTime
      const ranges = [
        [150, 260], // body
        [780, 2100], // air
        [520, 1450], // whistle
        [3600, 5600], // hiss
      ]
      this.layers.forEach((layer, index) => {
        const range = ranges[index] ?? [800, 1600]
        const target = range[0] + Math.random() * (range[1] - range[0])
        layer.filter.frequency.setTargetAtTime(target, now, 1.4 + Math.random() * 1.8)
        layer.pan.pan.setTargetAtTime(Math.random() * 1.1 - 0.55, now, 2.2 + Math.random() * 2)
      })
      // the overall level breathes
      this.windBus?.gain.setTargetAtTime(0.72 + Math.random() * 0.34, now, 2.4)
    }
    drift()
    this.timer = window.setInterval(drift, 1900)
  }

  private stopDrift() {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  /** The wind picks up, the branches start to sing. Throttled: audio params are not a 60fps bus. */
  setGust(gust: number) {
    if (!this.enabled || !this.ctx) return
    this.gust += (gust - this.gust) * 0.08
    const now = this.ctx.currentTime
    if (now - this.lastGustUpdate < 0.09) return
    this.lastGustUpdate = now
    const layers = this.layers
    if (layers[1]) layers[1].gain.gain.setTargetAtTime(layers[1].base + this.gust * 0.16, now, 0.3)
    if (layers[2]) layers[2].gain.gain.setTargetAtTime(0.004 + this.gust * 0.055, now, 0.35)
    if (layers[3]) layers[3].gain.gain.setTargetAtTime(layers[3].base + this.gust * 0.03, now, 0.3)
  }

  /** Dry leaves moving: many tiny rustles, never one clean swoosh. */
  private leafCluster(intensity: number, count: number, spread: number) {
    const ctx = this.ctx
    if (!ctx || !this.windBus || !this.noise) return
    const now = ctx.currentTime
    for (let i = 0; i < count; i++) {
      const t = now + i * (0.012 + Math.random() * spread)
      const source = ctx.createBufferSource()
      source.buffer = this.noise
      source.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1700 + Math.random() * 4600
      filter.Q.value = 0.7 + Math.random() * 1.6

      const gain = ctx.createGain()
      const peak = (0.012 + Math.random() * 0.026) * intensity
      const length = 0.05 + Math.random() * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(peak, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length)

      const pan = ctx.createStereoPanner()
      pan.pan.value = Math.random() * 1.3 - 0.65

      source.connect(filter).connect(gain).connect(pan).connect(this.windBus)
      source.start(t)
      source.stop(t + length + 0.1)
      source.onended = () => {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
        pan.disconnect()
      }
    }
  }

  /** A whole handful of leaves let go. */
  rustle(intensity = 1) {
    if (!this.enabled) return
    this.leafCluster(intensity, 18, 0.07)
  }

  /** The cursor brushing through the canopy. */
  brush(intensity = 1) {
    if (!this.enabled) return
    this.leafCluster(intensity * 0.7, 4, 0.05)
  }

  /**
   * A small warm chime for the wish: FM bells with a soft wooden attack,
   * rising by three notes and sitting inside the outdoor reverb.
   */
  chime() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    const notes = [783.99, 1046.5, 1318.51]

    notes.forEach((frequency, index) => {
      const start = now + index * 0.21
      const carrier = ctx.createOscillator()
      carrier.frequency.value = frequency
      carrier.type = 'sine'

      const modulator = ctx.createOscillator()
      modulator.frequency.value = frequency * 2.76
      const modGain = ctx.createGain()
      modGain.gain.setValueAtTime(frequency * 1.5, start)
      modGain.gain.exponentialRampToValueAtTime(frequency * 0.02, start + 0.55)
      modulator.connect(modGain).connect(carrier.frequency)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.11, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.6)

      const pan = ctx.createStereoPanner()
      pan.pan.value = (index - 1) * 0.22

      carrier.connect(gain).connect(pan).connect(this.master!)
      if (this.reverb) pan.connect(this.reverb)

      carrier.start(start)
      modulator.start(start)
      carrier.stop(start + 2.8)
      modulator.stop(start + 2.8)

      // the tiny click of something being struck
      if (this.noise) {
        const click = ctx.createBufferSource()
        click.buffer = this.noise
        click.loop = true
        const clickFilter = ctx.createBiquadFilter()
        clickFilter.type = 'highpass'
        clickFilter.frequency.value = 2600
        const clickGain = ctx.createGain()
        clickGain.gain.setValueAtTime(0.05, start)
        clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07)
        click.connect(clickFilter).connect(clickGain).connect(this.master!)
        click.start(start)
        click.stop(start + 0.1)
      }
    })

    this.leafCluster(0.6, 12, 0.09)
  }
}

export const ambience = new Ambience()
