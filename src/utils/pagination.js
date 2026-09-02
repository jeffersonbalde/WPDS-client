export function pageItemsFor(lastPage, currentPage) {
  const total = lastPage || 1
  const current = currentPage || 1
  if (total <= 1) return [1]
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const items = []
  const pushRange = (from, to) => {
    for (let i = from; i <= to; i += 1) items.push(i)
  }

  items.push(1)
  if (current <= 4) {
    pushRange(2, 5)
    items.push('ellipsis-right')
    items.push(total)
    return items
  }
  if (current >= total - 3) {
    items.push('ellipsis-left')
    pushRange(total - 4, total)
    return items
  }
  items.push('ellipsis-left')
  pushRange(current - 1, current + 1)
  items.push('ellipsis-right')
  items.push(total)
  return items
}
