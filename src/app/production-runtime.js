export const PRODUCTION_URL = 'https://vwfnvgkxipwcfcunstvu.supabase.co';
export const PRODUCTION_KEY = 'sb_publishable_UX0fNvjDFHE8n3fuvgk2sw_NiEIB1Bg';

/**
 * Production runtime for the modular Collect SoonSoonTCG application.
 *
 * Unlike the isolated beta runtime, this deliberately uses the browser's
 * normal storage, the production Supabase project and normal network access.
 * Authorization remains enforced by the existing Supabase RLS/RPC policies.
 */
export function createProductionRuntime(host = window) {
  // Preserve the globals used by image cleanup and unload-time analytics.
  host.COLLECT_TCG_SUPABASE_URL = PRODUCTION_URL;
  host.COLLECT_TCG_SUPABASE_KEY = PRODUCTION_KEY;

  const nativeFetch = host.fetch.bind(host);
  return {
    localStorage: host.localStorage,
    sessionStorage: host.sessionStorage,
    fetch: nativeFetch,
    config: { mode: 'production', url: PRODUCTION_URL, key: PRODUCTION_KEY },
    createClient() {
      // Keep Supabase's normal production auth storage key/session behavior so
      // existing owner sessions continue to work across deployment upgrades.
      return host.supabase.createClient(PRODUCTION_URL, PRODUCTION_KEY);
    }
  };
}
