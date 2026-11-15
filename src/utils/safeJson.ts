export async function parseJsonSafely<T = Record<string, unknown>>(
  res: Response
): Promise<{ data: T | null; rawText: string }> {
  const rawText = await res.text();
  if (!rawText) {
    return { data: null, rawText: '' };
  }
  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: null, rawText };
  }
}

export function buildHttpErrorMessage(
  res: Response,
  data: { error?: string; message?: string } | null,
  rawText: string,
  fallbackMessage: string
): string {
  if (data?.error && typeof data.error === 'string') return data.error;
  if (data?.message && typeof data.message === 'string') return data.message;
  const trimmed = rawText.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
    return `${fallbackMessage} (Server mengembalikan halaman HTML / HTTP ${res.status})`;
  }
  if (trimmed && trimmed.length < 180) {
    return `${fallbackMessage} (${trimmed})`;
  }
  return `${fallbackMessage} (HTTP ${res.status})`;
}
