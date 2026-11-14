import {
  extractAuthFromRequest,
  buildExtractorSetCookieHeader,
  normalizeYouTubeCookies,
  startYouTubeDeviceAuth,
  pollYouTubeDeviceAuth,
  refreshYouTubeOAuthTokens,
  resolveAudioStreamInfo,
  invalidateAudioStreamCache,
  ExtractorAuthConfig,
  YouTubeOAuthTokens,
  YouTubeOAuthClientIdentity,
  VercelReq,
  VercelRes,
} from '../_youtube.js';

function isSecureRequest(req: VercelReq): boolean {
  const proto = req.headers?.['x-forwarded-proto'];
  const protoStr = Array.isArray(proto) ? proto[0] : proto;
  return protoStr === 'https';
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Range, Content-Type, X-YouTube-Cookies, X-YouTube-OAuth, X-Extractor-Url'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const secure = isSecureRequest(req);

  if (req.method === 'GET') {
    const auth = extractAuthFromRequest(req.headers);
    const hasEnvCookies = Boolean(normalizeYouTubeCookies(process.env.YOUTUBE_COOKIES));
    const hasEnvExtractor = Boolean(
      process.env.COBALT_API_URL?.trim() ||
        process.env.PIPED_API_URL?.trim() ||
        process.env.INVIDIOUS_API_URL?.trim()
    );
    const mode = auth.oauthTokens
      ? 'oauth'
      : auth.cookies
      ? 'cookies'
      : auth.extractorUrl
      ? 'custom_server'
      : hasEnvCookies || hasEnvExtractor
      ? 'env'
      : 'none';

    return res.status(200).json({
      authenticated: mode !== 'none',
      mode,
      hasOAuth: Boolean(auth.oauthTokens?.access_token),
      hasCookies: Boolean(auth.cookies),
      extractorUrl: auth.extractorUrl || null,
      hasEnvFallback: hasEnvCookies || hasEnvExtractor,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as Record<string, any>;
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'start_device') {
      const deviceData = await startYouTubeDeviceAuth();
      return res.status(200).json(deviceData);
    }

    if (action === 'poll_device') {
      const deviceCode = typeof body.deviceCode === 'string' ? body.deviceCode.trim() : '';
      const client = body.client as YouTubeOAuthClientIdentity | undefined;
      if (!deviceCode) {
        return res.status(400).json({ error: 'deviceCode diperlukan' });
      }
      const pollRes = await pollYouTubeDeviceAuth({ deviceCode, client });
      if (pollRes.status === 'authorized' && pollRes.credentials) {
        const existing = extractAuthFromRequest(req.headers);
        const nextConfig: ExtractorAuthConfig = {
          ...existing,
          oauthTokens: pollRes.credentials,
        };
        res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(nextConfig, secure));
      }
      return res.status(200).json(pollRes);
    }

    if (action === 'restore' || action === 'save_config') {
      const existing = extractAuthFromRequest(req.headers);
      let oauthTokens = body.oauthTokens as YouTubeOAuthTokens | undefined;
      if (oauthTokens === undefined && body.clearOAuth !== true) {
        oauthTokens = existing.oauthTokens;
      }

      if (oauthTokens?.refresh_token) {
        const expMs = new Date(oauthTokens.expiry_date || 0).getTime();
        if (!Number.isFinite(expMs) || Date.now() >= expMs - 60_000) {
          try {
            oauthTokens = await refreshYouTubeOAuthTokens(oauthTokens);
          } catch {
            // keep existing tokens if refresh fails temporarily
          }
        }
      }

      const rawCookies =
        typeof body.cookies === 'string'
          ? normalizeYouTubeCookies(body.cookies)
          : body.clearCookies === true
          ? undefined
          : existing.cookies;

      const rawExtractorUrl =
        typeof body.extractorUrl === 'string'
          ? body.extractorUrl.trim().replace(/\/+$/, '') || undefined
          : body.clearExtractorUrl === true
          ? undefined
          : existing.extractorUrl;

      if (rawExtractorUrl && !/^https?:\/\//i.test(rawExtractorUrl)) {
        return res.status(400).json({
          error: 'URL server ekstraktor harus diawali http:// atau https://',
        });
      }

      const nextConfig: ExtractorAuthConfig = {
        oauthTokens: oauthTokens?.access_token ? oauthTokens : undefined,
        cookies: rawCookies || undefined,
        extractorUrl: rawExtractorUrl || undefined,
      };

      res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(nextConfig, secure));

      const testVideoId = typeof body.testVideoId === 'string' ? body.testVideoId.trim() : '';
      let verification: { available: boolean; status: string; reason?: string } | undefined;
      if (body.verify && testVideoId) {
        invalidateAudioStreamCache(testVideoId);
        const resolved = await resolveAudioStreamInfo(testVideoId, nextConfig);
        if (resolved.refreshedOAuth) {
          nextConfig.oauthTokens = resolved.refreshedOAuth;
          res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(nextConfig, secure));
        }
        verification = {
          available: Boolean(resolved.stream),
          status: resolved.status,
          reason: resolved.reason,
        };
      }

      return res.status(200).json({
        ok: true,
        oauthTokens: nextConfig.oauthTokens,
        hasCookies: Boolean(nextConfig.cookies),
        extractorUrl: nextConfig.extractorUrl || null,
        verification,
      });
    }

    if (action === 'disconnect') {
      res.setHeader('Set-Cookie', buildExtractorSetCookieHeader(null, secure));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Aksi extractor-auth tidak dikenal' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memproses otorisasi YouTube';
    return res.status(500).json({ error: message });
  }
}
