// What's wrong with adding `qty` of a variant under its quantity rule (order
// limits), counting the `inCart` units already in the cart; null when it's fine.
// `rule`: { min, max, increment } or null.
export function quantityProblem(rule, qty, inCart = 0) {
  if (!rule) return null;
  const step = rule.increment || 1;
  const total = qty + inCart;
  if (rule.min != null && total < rule.min) return inCart ? `You have ${inCart} in your cart. Add at least ${rule.min - inCart} more.` : `Order at least ${rule.min}.`;
  if (rule.max != null && total > rule.max) return inCart ? `You have ${inCart} in your cart. Add at most ${Math.max(0, rule.max - inCart)} more.` : `Order at most ${rule.max}.`;
  if (total % step) return `Sold in packs of ${step}.`;
  return null;
}
