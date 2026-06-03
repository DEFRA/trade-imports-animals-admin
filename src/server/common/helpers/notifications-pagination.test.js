import { describe, expect, test } from 'vitest'

import { buildPagination } from './notifications-pagination.js'

describe('#buildPagination', () => {
  test('Should return null when totalPages is 0', () => {
    expect(buildPagination({ page: 0, totalPages: 0 })).toBeNull()
  })

  test('Should return null when totalPages is 1', () => {
    expect(buildPagination({ page: 0, totalPages: 1 })).toBeNull()
  })

  test('Should build previous + next + items for a middle page (0-based input, 1-based hrefs)', () => {
    const model = buildPagination({ page: 1, totalPages: 3 })

    expect(model.previous).toEqual({ href: '/notifications' })
    expect(model.next).toEqual({ href: '/notifications?page=3' })
    expect(model.items).toEqual([
      { number: 1, href: '/notifications', current: false },
      { number: 2, href: '/notifications?page=2', current: true },
      { number: 3, href: '/notifications?page=3', current: false }
    ])
  })

  test('Should omit previous on the first page', () => {
    const model = buildPagination({ page: 0, totalPages: 3 })

    expect(model.previous).toBeUndefined()
    expect(model.next).toEqual({ href: '/notifications?page=2' })
    expect(model.items[0]).toEqual({
      number: 1,
      href: '/notifications',
      current: true
    })
  })

  test('Should omit next on the last page', () => {
    const model = buildPagination({ page: 2, totalPages: 3 })

    expect(model.next).toBeUndefined()
    expect(model.previous).toEqual({ href: '/notifications?page=2' })
    expect(model.items.at(-1)).toEqual({
      number: 3,
      href: '/notifications?page=3',
      current: true
    })
  })

  test('Should clamp out-of-range page to the last page', () => {
    const model = buildPagination({ page: 99, totalPages: 3 })

    expect(model.next).toBeUndefined()
    expect(model.previous).toEqual({ href: '/notifications?page=2' })
  })

  test('Should insert ellipsis between distant page numbers', () => {
    const model = buildPagination({ page: 4, totalPages: 10 })

    const numbers = model.items.map((item) =>
      item.ellipsis ? '…' : item.number
    )
    // Window of 2 around current (5 in 1-based) ⇒ pages 3–7,
    // plus endpoints 1 and 10, with ellipses bridging the gaps.
    expect(numbers).toEqual([1, '…', 3, 4, 5, 6, 7, '…', 10])
  })

  test('Should honour a custom baseUrl', () => {
    const model = buildPagination(
      { page: 1, totalPages: 3 },
      '/admin/notifications'
    )

    expect(model.previous).toEqual({ href: '/admin/notifications' })
    expect(model.next).toEqual({ href: '/admin/notifications?page=3' })
  })
})
