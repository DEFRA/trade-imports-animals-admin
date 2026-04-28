import { describe, test, expect } from 'vitest'

import { label } from './label.js'

describe('#label', () => {
  describe('Override map hits', () => {
    test('reEntry → Re-entry', () => {
      expect(label('reEntry')).toBe('Re-entry')
    })

    test('COMPLETE → Safe', () => {
      expect(label('COMPLETE')).toBe('Safe')
    })

    test('REJECTED → Virus found', () => {
      expect(label('REJECTED')).toBe('Virus found')
    })

    test('PENDING → Pending', () => {
      expect(label('PENDING')).toBe('Pending')
    })

    test('complete (fileStatus) → Uploaded', () => {
      expect(label('complete')).toBe('Uploaded')
    })

    test('rejected (fileStatus) → Rejected', () => {
      expect(label('rejected')).toBe('Rejected')
    })

    test('breedingAndOrProduction → Breeding and/or production', () => {
      expect(label('breedingAndOrProduction')).toBe(
        'Breeding and/or production'
      )
    })
  })

  describe('camelCase generic transform', () => {
    test('internalMarket → Internal market', () => {
      expect(label('internalMarket')).toBe('Internal market')
    })

    test('approvedBodies → Approved bodies', () => {
      expect(label('approvedBodies')).toBe('Approved bodies')
    })

    test('slaughter → Slaughter', () => {
      expect(label('slaughter')).toBe('Slaughter')
    })
  })

  describe('SCREAMING_SNAKE_CASE generic transform', () => {
    test('HUMAN_CONSUMPTION → Human consumption', () => {
      expect(label('HUMAN_CONSUMPTION')).toBe('Human consumption')
    })

    test('INTERNAL_MARKET → Internal market', () => {
      expect(label('INTERNAL_MARKET')).toBe('Internal market')
    })
  })

  describe('Already-readable passthrough', () => {
    test('yes → Yes', () => {
      expect(label('yes')).toBe('Yes')
    })

    test('no → No', () => {
      expect(label('no')).toBe('No')
    })
  })

  describe('Null/undefined safety', () => {
    test('null → empty string', () => {
      expect(label(null)).toBe('')
    })

    test('undefined → empty string', () => {
      expect(label(undefined)).toBe('')
    })

    test('empty string → empty string', () => {
      expect(label('')).toBe('')
    })
  })
})
