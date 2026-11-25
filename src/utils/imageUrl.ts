const resolvedUrlCache = new Map<string, string>();
const inflightResolutions = new Map<string, Promise<string>>();

export function isGooglePhotosShareLink(raw: string): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'photos.app.goo.gl' ||
      host === 'photos.google.com' ||
      (host === 'goo.gl' && parsed.pathname.startsWith('/photos'))
    );
  } catch {
    return false;
  }
}

export function normalizeImageSrcSync(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    // Dropbox share link (?dl=0 -> ?raw=1) while keeping rlkey intact
    if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
      url.searchParams.delete('dl');
      url.searchParams.set('raw', '1');
      return url.toString();
    }

    // Direct Google Photos CDN URL (strip social crop suffix if present)
    if (
      (host === 'lh3.googleusercontent.com' || host.endsWith('.googleusercontent.com')) &&
      !url.pathname.startsWith('/a/') &&
      !url.pathname.startsWith('/a-/')
    ) {
      if (/=[^/]+$/.test(url.pathname)) {
        url.pathname = url.pathname.replace(/=[^/]+$/, '=w1400-no');
        return url.toString();
      }
      if (url.pathname.startsWith('/pw/')) {
        url.pathname = `${url.pathname}=w1400-no`;
        return url.toString();
      }
    }

    // Google Drive file link -> direct thumbnail/image endpoint
    if (host === 'drive.google.com') {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const id = fileMatch?.[1] || url.searchParams.get('id');
      if (id && /^[a-zA-Z0-9_-]+$/.test(id)) {
        return `https://lh3.googleusercontent.com/d/${id}=w1400`;
      }
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

export function getCachedResolvedImageUrl(raw: string): string | undefined {
  return resolvedUrlCache.get((raw || '').trim());
}

export async function resolveImageUrlAsync(raw: string): Promise<string> {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (!isGooglePhotosShareLink(trimmed)) {
    return normalizeImageSrcSync(trimmed);
  }

  const cached = resolvedUrlCache.get(trimmed);
  if (cached) return cached;

  const inflight = inflightResolutions.get(trimmed);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const res = await fetch(`/api/resolve-image?url=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return '';
      const data = (await res.json()) as { ok?: boolean; imageUrl?: string };
      if (data.ok && data.imageUrl) {
        resolvedUrlCache.set(trimmed, data.imageUrl);
        return data.imageUrl;
      }
      return '';
    } catch {
      return '';
    } finally {
      inflightResolutions.delete(trimmed);
    }
  })();

  inflightResolutions.set(trimmed, task);
  return task;
}
