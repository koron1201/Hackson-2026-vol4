import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAlarmAudioActive, startAlarmAudio, stopAlarmAudio } from './alarmAudio'

describe('alarmAudio', () => {
  afterEach(() => stopAlarmAudio())

  it('keeps a single alarm active until it is explicitly stopped', async () => {
    const oscillator = { connect: vi.fn().mockReturnThis(), start: vi.fn(), stop: vi.fn(), type: '', frequency: { value: 0 } }
    const gain = { connect: vi.fn().mockReturnThis(), gain: { value: 0 } }
    const context = { createOscillator: () => oscillator, createGain: () => gain, destination: {}, close: vi.fn() }
    class MockAudioContext {
      constructor() {
        return context
      }
    }
    vi.stubGlobal('AudioContext', MockAudioContext)

    await startAlarmAudio()
    await startAlarmAudio()

    expect(isAlarmAudioActive()).toBe(true)
    expect(oscillator.start).toHaveBeenCalledOnce()
    stopAlarmAudio()
    expect(isAlarmAudioActive()).toBe(false)
    expect(oscillator.stop).toHaveBeenCalledOnce()
  })
})
