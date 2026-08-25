export type IntentSearchItem = {
  id: string;
  kind: string;
  title: string;
  description: string;
  keywords: string[];
  payload: string;
};

export type RankedIntent<T extends IntentSearchItem> = {
  item: T;
  score: number;
  matched: string[];
};

type Edge = { from: string; to: string; weight: number };

const EDGES: Edge[] = [
  { from: "attendance", to: "punch", weight: 0.99 },
  { from: "attendance", to: "photo", weight: 0.78 },
  { from: "attendance", to: "location", weight: 0.78 },
  { from: "attendance", to: "shift", weight: 0.88 },
  { from: "late", to: "attendance", weight: 0.98 },
  { from: "late", to: "deduction", weight: 0.99 },
  { from: "late", to: "minutes", weight: 0.90 },
  { from: "deduct", to: "deduction", weight: 1.0 },
  { from: "penalty", to: "deduction", weight: 0.95 },
  { from: "salary", to: "deduction", weight: 0.80 },
  { from: "journey", to: "route", weight: 0.99 },
  { from: "journey", to: "distance", weight: 0.96 },
  { from: "journey", to: "location", weight: 0.86 },
  { from: "travel", to: "journey", weight: 0.98 },
  { from: "trip", to: "journey", weight: 0.96 },
  { from: "site", to: "geofence", weight: 0.86 },
  { from: "boundary", to: "geofence", weight: 0.98 },
  { from: "outside", to: "geofence", weight: 0.84 },
  { from: "geofence", to: "location", weight: 0.94 },
  { from: "geofence", to: "alert", weight: 0.90 },
  { from: "visit", to: "proof", weight: 0.93 },
  { from: "visit", to: "photo", weight: 0.88 },
  { from: "visit", to: "location", weight: 0.86 },
  { from: "customer", to: "visit", weight: 0.96 },
  { from: "dealer", to: "visit", weight: 0.96 },
  { from: "approval", to: "manager", weight: 0.99 },
  { from: "approve", to: "approval", weight: 1.0 },
  { from: "expense", to: "approval", weight: 0.78 },
  { from: "threshold", to: "approval", weight: 0.86 },
  { from: "amount", to: "threshold", weight: 0.66 },
  { from: "scan", to: "qr", weight: 0.94 },
  { from: "scan", to: "barcode", weight: 0.90 },
  { from: "scan", to: "nfc", weight: 0.82 },
  { from: "machine", to: "scan", weight: 0.96 },
  { from: "asset", to: "scan", weight: 0.94 },
  { from: "proof", to: "photo", weight: 0.90 },
  { from: "proof", to: "signature", weight: 0.80 },
  { from: "proof", to: "location", weight: 0.76 },
  { from: "notify", to: "alert", weight: 0.98 },
  { from: "alert", to: "manager", weight: 0.74 },
  { from: "secure", to: "biometric", weight: 0.94 },
  { from: "fingerprint", to: "biometric", weight: 1.0 },
  { from: "face", to: "biometric", weight: 0.92 },
  { from: "battery", to: "alert", weight: 0.84 },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9₹]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  const words = normalize(value).split(" ").filter(Boolean);
  const result = new Set(words);
  for (let i = 0; i < words.length - 1; i += 1) {
    result.add(`${words[i]} ${words[i + 1]}`);
  }
  return [...result];
}

function graphWeights(query: string) {
  const best = new Map<string, number>();
  const queue: Array<{ node: string; score: number; depth: number }> = [];

  for (const token of tokens(query)) {
    const score = token.includes(" ") ? 1.35 : 1;
    best.set(token, score);
    queue.push({ node: token, score, depth: 0 });
  }

  while (queue.length) {
    queue.sort((a, b) => b.score - a.score);
    const current = queue.shift()!;
    if (current.depth >= 3) continue;

    for (const edge of EDGES) {
      let next: string | null = null;
      let direction = 1;
      if (edge.from === current.node) {
        next = edge.to;
      } else if (edge.to === current.node) {
        next = edge.from;
        direction = 0.68;
      }
      if (!next) continue;

      const score = current.score * edge.weight * direction * 0.86;
      if (score <= (best.get(next) ?? 0) + 0.025) continue;
      best.set(next, score);
      queue.push({ node: next, score, depth: current.depth + 1 });
    }
  }

  return best;
}

export function rankIntentCandidates<T extends IntentSearchItem>(
  candidates: T[],
  query: string,
  existingSignals: string[] = [],
): RankedIntent<T>[] {
  const q = normalize(query);
  if (!q) {
    return candidates
      .map((item) => ({ item, score: item.kind === "recipe" ? 20 : 2, matched: [] }))
      .sort((a, b) => b.score - a.score);
  }

  const weights = graphWeights(query);
  const existing = new Set(existingSignals.flatMap(tokens));

  return candidates
    .map((item) => {
      const title = normalize(item.title);
      const haystack = normalize(
        [item.title, item.description, ...item.keywords, item.payload].join(" "),
      );
      let score = haystack.includes(q) ? 30 : 0;
      const matched: string[] = [];

      for (const [term, weight] of weights) {
        if (term.length < 2) continue;
        if (title.includes(term)) {
          score += 9 * weight;
          matched.push(term);
        } else if (haystack.includes(term)) {
          score += 3.4 * weight;
          matched.push(term);
        }
      }

      if (item.kind === "recipe" && score > 0) score += 6;
      for (const signal of existing) {
        if (signal.length > 2 && haystack.includes(signal)) score += 0.7;
      }

      return { item, score, matched: [...new Set(matched)] };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

const SUBSUMES: Record<string, string[]> = {
  late_deduction: ["attendance_essentials"],
};

export function suggestRecipeComposition<T extends IntentSearchItem>(
  ranked: RankedIntent<T>[],
) {
  const recipes = ranked.filter(
    (entry) => entry.item.kind === "recipe" && entry.score >= 10,
  );
  if (recipes.length < 2) return [];

  const top = recipes[0].score;
  const selected: string[] = [];

  for (const entry of recipes) {
    if (entry.score < top * 0.46) continue;
    const key = entry.item.payload;

    const superseded = selected.filter((selectedKey) =>
      SUBSUMES[key]?.includes(selectedKey),
    );
    if (superseded.length) {
      for (const old of superseded) {
        const index = selected.indexOf(old);
        if (index >= 0) selected.splice(index, 1);
      }
    }

    if (selected.some((selectedKey) => SUBSUMES[selectedKey]?.includes(key))) {
      continue;
    }

    if (!selected.includes(key)) selected.push(key);
    if (selected.length >= 3) break;
  }

  return selected.length >= 2 ? selected : [];
}
