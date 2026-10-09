// Reuse approved-app OAuth credentials server-side; never log upstream bodies.
export function createTokenProvider({ clientId, clientSecret, fetcher = fetch, now = Date.now }) {
  let cached, pending;
  return async function token() {
    if (!clientId || !clientSecret) throw new Error('TM credentials have not been configured by the developer.');
    if (cached && cached.expiresAt > now() + 30000) return cached;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher('https://auth.vextm.dwabtech.com/oauth2/token', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
      });
      if (!response.ok) {
        const hint = response.status === 400 || response.status === 401 || response.status === 403
          ? 'Check that TM_CLIENT_ID and TM_CLIENT_SECRET match the approved credential pair, without added quotes or spaces.'
          : response.status === 429
            ? 'The token server is limiting requests. Wait a minute and try again.'
            : response.status >= 500
              ? 'The token server is unavailable. Try again later.'
              : 'Check the token service configuration.';
        throw new Error(`TM authentication failed (HTTP ${response.status}). ${hint}`);
      }
      const data = await response.json();
      if (typeof data.access_token !== 'string' || !data.access_token || data.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(data.expires_in) || data.expires_in <= 30) {
        throw new Error('TM authentication returned an invalid token.');
      }
      cached = { accessToken: data.access_token, expiresAt: now() + data.expires_in * 1000 };
      return cached;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
