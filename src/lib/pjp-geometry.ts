// BRIXTA_PJP_V1 — simple spherical distance for stop prioritization.
// These are air distances, NEVER road distances or travel-time estimates.
export type PjpPosition = { lat: number; lng: number };

export function pjpValidPoint(point: PjpPosition | null | undefined): point is PjpPosition {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 && (point.lat !== 0 || point.lng !== 0));
}

export function pjpKm(a: PjpPosition, b: PjpPosition): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pjpNearest<T extends { location: PjpPosition }>(
  origin: PjpPosition,
  candidates: T[],
): T[] {
  const remaining = [...candidates];
  const result: T[] = [];
  let here = origin;
  while (remaining.length) {
    let closest = 0;
    let distance = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const value = pjpKm(here, remaining[i].location);
      if (value < distance) { distance = value; closest = i; }
    }
    const [next] = remaining.splice(closest, 1);
    result.push(next);
    here = next.location;
  }
  return result;
}
