/** 两个角度快照之间的缓动插值。 */
export function interpolate(
  a: Record<string, number>,
  b: Record<string, number>,
  t: number,
) {
  const ease = t * t * (3 - 2 * t);
  return Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [
      k,
      (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * ease,
    ]),
  );
}
