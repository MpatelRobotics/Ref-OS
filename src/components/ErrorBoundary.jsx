import React from "react";
import { APP_VERSION } from "../appVersion";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error("Ref OS fatal render error", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error?.message || String(this.state.error);
    const copyDiagnostics = async () => {
      const report = [
        `Ref OS ${APP_VERSION}`,
        `Time: ${new Date().toISOString()}`,
        `URL: ${location.href}`,
        `Browser: ${navigator.userAgent}`,
        `Error: ${message}`,
      ].join("\n");
      try { await navigator.clipboard.writeText(report); } catch {}
    };
    const clearCache = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith("refos-")).map((k) => caches.delete(k)));
      } catch {}
      location.reload();
    };
    return (
      <div className="min-h-screen bg-slate-100 p-6 grid place-items-center font-sans">
        <div className="w-full max-w-lg bg-white rounded-2xl border p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Ref OS encountered an error</h1>
          <p className="text-sm text-slate-600 mt-2">The app did not load correctly. Your saved event data is not deleted by this screen.</p>
          <div className="mt-4 rounded-lg bg-slate-950 text-slate-100 p-3 text-xs font-mono break-words">{message}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            <button onClick={() => location.reload()} className="rounded-xl bg-slate-900 text-white py-2.5 font-semibold">Reload app</button>
            <button onClick={clearCache} className="rounded-xl border py-2.5 font-semibold">Clear app cache</button>
            <button onClick={copyDiagnostics} className="rounded-xl border py-2.5 font-semibold">Copy diagnostics</button>
          </div>
          <div className="text-xs text-slate-400 mt-4">Version {APP_VERSION}</div>
        </div>
      </div>
    );
  }
}
