import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { ensureAnonymousSession } from './api';
import { supabase } from './supabaseClient';

export const passkeysSupported = () => Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials);
export async function developerPasskey(eventId, credential) {
  await ensureAnonymousSession();
  const invoke = async body => {
    const { data, error } = await supabase.functions.invoke('refos-developer-passkey', { body });
    if (error || data?.error || !data) throw Error('Passkey service unavailable or sign-in refused. You can still use your Developer code.');
    return data;
  };
  const register = credential !== undefined;
  const begin = await invoke({action:register?'register-options':'authenticate-options',eventId,...(register?{credential}:{})});
  const response = register ? await startRegistration({optionsJSON:begin.options}) : await startAuthentication({optionsJSON:begin.options});
  const result = await invoke({action:register?'register-verify':'authenticate-verify',challengeId:begin.challengeId,response});
  if(result.ok!==true)throw Error('Passkey could not be verified.');
}
