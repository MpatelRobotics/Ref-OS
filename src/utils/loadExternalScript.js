const externalScriptPromises = new Map();

export function loadExternalScript(src, globalName) {
  if (globalName && globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
  if (externalScriptPromises.has(src)) return externalScriptPromises.get(src);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-refos-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalName ? globalThis[globalName] : true), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load support script.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.refosSrc = src;
    script.onload = () => resolve(globalName ? globalThis[globalName] : true);
    script.onerror = () => reject(new Error("Could not load support script."));
    document.head.appendChild(script);
  });
  externalScriptPromises.set(src, promise);
  return promise;
}
