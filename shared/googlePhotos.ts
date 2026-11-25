const GOOGLE_PHOTOS_HOSTS = new Set(['photos.app.goo.gl', 'photos.google.com']);

export function isGooglePhotosShareUrl(rawUrl: string): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (GOOGLE_PHOTOS_HOSTS.has(host)) {
      return true;
    }
    if (host === 'goo.gl' && parsed.pathname.startsWith('/photos')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isGoogleUserContentUrl(rawUrl: string): boolean {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'lh3.googleusercontent.com' || host.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

export function upgradeGooglePhotosImageUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!isGoogleUserContentUrl(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    // Keep user avatar URLs untouched
    if (parsed.pathname.startsWith('/a/') || parsed.pathname.startsWith('/a-/')) {
      return parsed.toString();
    }
    // Strip social-card crop (=w600-h315-p-k) and request crisp uncropped HD
    if (/=[^/]+$/.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/=[^/]+$/, '=w1400-no');
    } else if (parsed.pathname.startsWith('/pw/')) {
      parsed.pathname = `${parsed.pathname}=w1400-no`;
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

function unescapeExtractedUrl(raw: string): string {
  return raw
    .replace(/&amp;/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\x3d/gi, '=')
    .replace(/\\x26/gi, '&')
    .replace(/\\\//g, '/')
    .trim();
}

export function extractGooglePhotosImageFromHtml(html: string): string | null {
  if (!html) return null;

  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /(https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_-]+(?:=[A-Za-z0-9_-]+)?)/,
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match?.[1]) {
      const candidate = unescapeExtractedUrl(match[1]);
      if (isGoogleUserContentUrl(candidate)) {
        return upgradeGooglePhotosImageUrl(candidate);
      }
    }
  }

  return null;
}

export async function resolveGooglePhotosShareUrl(rawUrl: string): Promise<string | null> {
  const startUrl = (rawUrl || '').trim();
  if (!isGooglePhotosShareUrl(startUrl)) {
    return null;
  }

  let currentUrl = startUrl;
  const maxHops = 5;

  for (let hop = 0; hop < maxHops; hop++) {
    if (isGoogleUserContentUrl(currentUrl)) {
      return upgradeGooglePhotosImageUrl(currentUrl);
    }
    if (!isGooglePhotosShareUrl(currentUrl)) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return null;
        let nextUrl = '';
        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch {
          return null;
        }
        if (isGoogleUserContentUrl(nextUrl)) {
          return upgradeGooglePhotosImageUrl(nextUrl);
        }
        if (!isGooglePhotosShareUrl(nextUrl)) {
          return null;
        }
        currentUrl = nextUrl;
        continue;
      }

      if (!res.ok) {
        return null;
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.startsWith('image/') && isGoogleUserContentUrl(currentUrl)) {
        return upgradeGooglePhotosImageUrl(currentUrl);
      }

      const html = (await res.text()).slice(0, 1500000);
      return extractGooglePhotosImageFromHtml(html);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}
