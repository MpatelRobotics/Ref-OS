import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { createMobileTmClient } from './tmMobileClient.js';

const sockets = registerPlugin('RefOsTmSockets');
export const isTmMobile = () => Capacitor.isNativePlatform();
let client;
export function mobileTmRequest(route, body) {
  client ||= createMobileTmClient({
    http: options => CapacitorHttp.request(options), sockets,
    cloudUrl: import.meta.env.VITE_SUPABASE_URL,
  });
  return client.request(route, body);
}
