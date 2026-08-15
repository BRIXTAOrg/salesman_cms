
export async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body
        ? { "content-type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: any = {};

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("Server returned invalid JSON.");
    }
  }

  if (!response.ok) {
    throw new Error(
      body?.error ??
        body?.message ??
        `Request failed (${response.status}).`,
    );
  }

  return body as T;
}

export function formatWhen(
  value?: string | null,
) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const delta = Date.now() - date.getTime();
  const minutes = Math.floor(delta / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export function formatDateTime(
  value?: string | null,
) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function cx(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes.filter(Boolean).join(" ");
}
