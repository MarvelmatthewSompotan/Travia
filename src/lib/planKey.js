export function planKeyFor(plan) {
  return `${plan?.title ?? ''}::${plan?.total_price ?? ''}`
}
