// Public explanations only: never render storage paths, signed URLs, or raw server errors.
export const PHOTO_FAILURES = {
  offline: {label:'Offline', message:'This device is offline and the picture is not available in its local cache. Reconnect, then retry.'},
  network: {label:'Connection', message:'The picture service could not be reached. Check Wi-Fi or mobile data and retry. A blocked request can also cause this.'},
  timeout: {label:'Timed out', message:'The picture request took too long. Check your connection and retry.'},
  access: {label:'Access', message:'The server rejected picture access or the link expired. Retry for a new link. If it keeps failing, sign back into this event and ask an Admin to check photo access.'},
  missing: {label:'Not found', message:'The server reported that the picture was not found. Ask an Admin to check whether it is still in storage and available to this event; retake it if needed.'},
  cloud: {label:'Service', message:'The storage service returned a server error. Retry shortly. If it continues, ask an Admin to check the storage service.'},
  rate: {label:'Busy', message:'The storage service is limiting requests. Wait a moment, then retry.'},
  empty: {label:'Empty file', message:'The server returned an empty picture file. Retry; if this repeats, retake the picture.'},
  decode: {label:'Image format', message:'The file loaded, but this device could not display it. It may be damaged or unsupported. Retry; if this repeats, retake the picture.'},
  unknown: {label:'Unavailable', message:'The picture could not load, but the app could not determine the cause. Retry, then ask an Admin to check photo storage and event access.'},
};
export function photoFailureReason(error) {
  if (error?.photoReason && PHOTO_FAILURES[error.photoReason]) return error.photoReason;
  const status = Number(error?.statusCode || error?.status || 0);
  if (status === 401 || status === 403) return 'access';
  if (status === 404) return 'missing';
  if (status === 429) return 'rate';
  if (status >= 500) return 'cloud';
  if (status === 408 || error?.name === 'AbortError') return 'timeout';
  // Storage may return an error body with HTTP 400. Use only explicit evidence.
  const message = String(error?.message || '').toLowerCase();
  if (/not found|does not exist/.test(message)) return 'missing';
  if (/jwt|expired|unauthorized|permission|row.level security|access denied/.test(message)) return 'access';
  if (/failed to fetch|network|load failed/.test(message)) return 'network';
  return 'unknown';
}
