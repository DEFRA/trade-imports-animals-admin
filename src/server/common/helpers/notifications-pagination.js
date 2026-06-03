const MAX_PAGE_WINDOW = 2

function buildHref(baseUrl, pageOneBased) {
  return pageOneBased === 1 ? baseUrl : `${baseUrl}?page=${pageOneBased}`
}

function buildItems(currentPageOneBased, totalPages, baseUrl) {
  const items = []
  let lastEmittedPage = 0

  for (let page = 1; page <= totalPages; page++) {
    const isEndpoint = page === 1 || page === totalPages
    const isInWindow = Math.abs(page - currentPageOneBased) <= MAX_PAGE_WINDOW

    if (!isEndpoint && !isInWindow) {
      continue
    }

    if (page - lastEmittedPage > 1) {
      items.push({ ellipsis: true })
    }

    items.push({
      number: page,
      href: buildHref(baseUrl, page),
      current: page === currentPageOneBased
    })

    lastEmittedPage = page
  }

  return items
}

/**
 * Build the view model `govukPagination` consumes.
 * Input `page` is 0-based (the backend's echo); URLs are 1-based.
 * Returns `null` when there's nothing to paginate.
 */
export function buildPagination(
  { page = 0, totalPages = 0 } = {},
  baseUrl = '/notifications'
) {
  if (totalPages <= 1) {
    return null
  }

  const lastPageIndex = totalPages - 1
  const noLowerThanZero = Math.max(page, 0)
  const clampedZeroBased = Math.min(noLowerThanZero, lastPageIndex)
  const currentPageOneBased = clampedZeroBased + 1

  const model = {
    items: buildItems(currentPageOneBased, totalPages, baseUrl)
  }

  if (currentPageOneBased > 1) {
    model.previous = { href: buildHref(baseUrl, currentPageOneBased - 1) }
  }
  if (currentPageOneBased < totalPages) {
    model.next = { href: buildHref(baseUrl, currentPageOneBased + 1) }
  }

  return model
}
