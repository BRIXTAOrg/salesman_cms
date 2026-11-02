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

/**
 * Select real CRM sites throughout the requested radius, not just the closest
 * cluster, then order the selected sites by nearest-neighbour AIR distance.
 * Spread: 0 = compact, 100 = broad coverage. Not road/traffic optimization.
 * Runtime is O(number_of_candidates * number_of_selected_stops).
 */
export function pjpSpread<T extends { location: PjpPosition; priority?: number | null }>(
  origin: PjpPosition,
  candidates: T[],
  maxStops: number,
  spreadPercent: number,
  priorityFirst = false,
): T[] {
  const count = Math.max(0, Math.min(Math.floor(maxStops), candidates.length));
  if (!Number.isFinite(count) || count === 0) return [];
  const ranked = [...candidates].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityFirst && priority) return priority;
    return pjpKm(origin, a.location) - pjpKm(origin, b.location);
  });
  const spread = Math.max(0, Math.min(100, spreadPercent)) / 100;
  if (spread === 0) return pjpNearest(origin, ranked.slice(0, count));

  const distances = ranked.map(site => pjpKm(origin, site.location));
  const radiusScale = Math.max(1, ...distances);
  const priorities = ranked.map(site => site.priority ?? 0);
  const minPriority = Math.min(...priorities);
  const priorityRange = Math.max(1, Math.max(...priorities) - minPriority);
  const used = new Uint8Array(ranked.length);
  const selected = [0];
  used[0] = 1;
  const gaps = ranked.map(site => pjpKm(ranked[0].location, site.location));

  while (selected.length < count) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < ranked.length; i++) {
      if (used[i]) continue;
      const normalizedPriority = (priorities[i] - minPriority) / priorityRange;
      const score = 2 * spread * gaps[i] / radiusScale
        - (1 - spread) * distances[i] / radiusScale
        + (priorityFirst ? 0.25 : 0.02) * normalizedPriority;
      if (score > bestScore) { best = i; bestScore = score; }
    }
    if (best < 0) break;
    used[best] = 1;
    selected.push(best);
    for (let i = 0; i < ranked.length; i++) {
      if (!used[i]) gaps[i] = Math.min(
        gaps[i], pjpKm(ranked[best].location, ranked[i].location),
      );
    }
  }
  return pjpNearest(origin, selected.map(index => ranked[index]));
}

/**
 * Rank the first page of Nearby CRM sites for manual discovery. The returned
 * order is COVERAGE-FIRST, not route order. Full unselected candidates remain
 * accessible in subsequent pages via the UI.
 *
 * All distances are straight-line kilometres, not road distances.
 * Complexity: O(candidateCount * firstPageSize).
 */
export function pjpBrowseSpread<T extends { location: PjpPosition; priority?: number | null }>(
  origin: PjpPosition,
  candidates: T[],
  previewCount: number,
  spreadPercent: number,
): T[] {
  const count = Math.max(0, Math.min(Math.floor(previewCount), candidates.length));
  if (!count || !Number.isFinite(count)) return [];
  const spread = Math.max(0, Math.min(100, spreadPercent)) / 100;
  if (!spread) return candidates.slice(0, count);

  const originDistances = candidates.map(site => pjpKm(origin, site.location));
  const radiusScale = Math.max(1, ...originDistances);
  const used = new Uint8Array(candidates.length);
  const result: T[] = [];
  // Keep the first recommendation near the origin; diversify subsequent ones.
  let closest = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (originDistances[i] < originDistances[closest]) closest = i;
  }
  used[closest] = 1;
  result.push(candidates[closest]);
  const nearest = candidates.map(site => pjpKm(candidates[closest].location, site.location));

  while (result.length < count) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (used[i]) continue;
      // Increasing spread rewards locations far from all suggestions already shown.
      const score = (spread * 2.2) * (nearest[i] / radiusScale)
        - (1 - spread) * (originDistances[i] / radiusScale);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    if (best < 0) break;
    used[best] = 1;
    result.push(candidates[best]);
    for (let i = 0; i < candidates.length; i++) {
      if (!used[i]) nearest[i] = Math.min(
        nearest[i], pjpKm(candidates[best].location, candidates[i].location),
      );
    }
  }
  return result;
}
