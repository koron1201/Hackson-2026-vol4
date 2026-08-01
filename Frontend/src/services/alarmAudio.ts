let audioContext: AudioContext | undefined
let oscillator: OscillatorNode | undefined
let wakeLock: WakeLockSentinel | undefined

export function isAlarmAudioActive(): boolean {
  return oscillator !== undefined
}

/** Starts the in-browser alarm. It intentionally persists across route changes. */
export async function startAlarmAudio(): Promise<boolean> {
  if (isAlarmAudioActive()) return true

  try {
    audioContext = new AudioContext()
    oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 640
    gain.gain.value = 0.12
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start()
    navigator.vibrate?.([400, 200, 400])
    try {
      wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      // Wake Lock is optional. Keep the alarm running when it is unavailable.
    }
    return true
  } catch {
    stopAlarmAudio()
    return false
  }
}

/** Only QR verification or the explicit emergency-stop flow may call this. */
export function stopAlarmAudio(): void {
  try {
    oscillator?.stop()
  } catch {
    // An already-stopped oscillator needs no further handling.
  }
  oscillator = undefined
  navigator.vibrate?.(0)
  void wakeLock?.release()
  wakeLock = undefined
  if (audioContext) void audioContext.close()
  audioContext = undefined
}
