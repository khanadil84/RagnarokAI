import { describe, expect, it } from 'vitest'
import { joinDictation } from './useSpeechRecognition'

describe('joinDictation', () => {
  it('returns the transcript alone when the base is empty', () => {
    expect(joinDictation('', 'restore checkout capacity')).toBe(
      'restore checkout capacity',
    )
  })

  it('inserts a single space between a full base and the transcript', () => {
    expect(joinDictation('restore', 'checkout capacity')).toBe(
      'restore checkout capacity',
    )
  })

  it('does not double-space when the base already ends with whitespace', () => {
    expect(joinDictation('restore  ', 'checkout')).toBe('restore  checkout')
  })

  it('collapses internal whitespace and trims the transcript', () => {
    expect(joinDictation('restore', '  checkout\n  capacity  ')).toBe(
      'restore checkout capacity',
    )
  })

  it('leaves the base untouched when the transcript is empty or whitespace', () => {
    expect(joinDictation('restore', '')).toBe('restore')
    expect(joinDictation('restore', '   ')).toBe('restore')
  })
})
