import React, { useEffect, useState } from "react";
import { Copy, KeyRound, QrCode, X } from "lucide-react";
import QRCode from "qrcode";

async function hashAccessCode(code) {
  const data = new TextEncoder().encode(String(code));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function RoleAccessCodeManager({ eventId, config: sharedConfig, onSave, onClose }) {
  const [config, setConfig] = useState(() => sharedConfig || { version: 1, codes: {} });
  const [revealed, setRevealed] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`refosRoleCodes:${eventId}`) || "{}");
    } catch {
      return {};
    }
  });
  const [busyRole, setBusyRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setConfig(sharedConfig || { version: 1, codes: {} });
  }, [sharedConfig?.updatedAt, JSON.stringify(sharedConfig?.codes || {})]);

  const roleRows = [
    { key: "ref", label: "Referee", description: "Standard referee access" },
    { key: "judge", label: "Judge Advisor", description: "Judging and alliance access" },
    { key: "emcee", label: "Emcee", description: "Emcee event access" },
  ];

  const generateCandidate = () => {
    const array = new Uint32Array(4);
    globalThis.crypto.getRandomValues(array);
    const letters = ["A", "B", "C", "D"];
    return `${array[0] % 10}${letters[array[1] % letters.length]}${array[2] % 10}${array[3] % 10}`;
  };

  const generate = async (role) => {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
      setError("Secure code generation is not supported in this browser.");
      return;
    }
    setBusyRole(role);
    setError("");
    try {
      const existingHashes = new Set(Object.values(config?.codes || {}).map((v) => v?.hash).filter(Boolean));
      let code = "";
      let hash = "";
      for (let attempt = 0; attempt < 50; attempt += 1) {
        code = generateCandidate();
        hash = await hashAccessCode(code);
        if (!existingHashes.has(hash) || config?.codes?.[role]?.hash === hash) break;
      }
      const next = {
        ...config,
        version: 1,
        updatedAt: Date.now(),
        codes: {
          ...(config?.codes || {}),
          [role]: {
            code,
            hash,
            format: "N-L-N-N",
            enabled: true,
            updatedAt: Date.now(),
          },
        },
      };
      await onSave(next);
      setConfig(next);
      setRevealed((cur) => {
        const nextRevealed = { ...cur, [role]: code };
        try { sessionStorage.setItem(`refosRoleCodes:${eventId}`, JSON.stringify(nextRevealed)); } catch {}
        return nextRevealed;
      });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyRole("");
    }
  };

  const disable = async (role) => {
    if (!config?.codes?.[role]) return;
    setBusyRole(role);
    setError("");
    try {
      const next = {
        ...config,
        version: 1,
        updatedAt: Date.now(),
        codes: {
          ...(config?.codes || {}),
          [role]: {
            ...config.codes[role],
            enabled: false,
            updatedAt: Date.now(),
          },
        },
      };
      await onSave(next);
      setConfig(next);
      setRevealed((cur) => {
        const copy = { ...cur };
        delete copy[role];
        try { sessionStorage.setItem(`refosRoleCodes:${eventId}`, JSON.stringify(copy)); } catch {}
        return copy;
      });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyRole("");
    }
  };

  const disableAll = async () => {
    setBusyRole("all");
    setError("");
    try {
      const codes = {};
      for (const [key, value] of Object.entries(config?.codes || {})) {
        codes[key] = { ...value, enabled: false, updatedAt: Date.now() };
      }
      const next = { ...config, version: 1, updatedAt: Date.now(), codes };
      await onSave(next);
      setConfig(next);
      setRevealed({});
      try { sessionStorage.removeItem(`refosRoleCodes:${eventId}`); } catch {}
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyRole("");
    }
  };

  const copyCode = async (role) => {
    const code = config?.codes?.[role]?.code || revealed[role];
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {}
  };

  const loginQrPayload=(role,code)=>JSON.stringify({type:"refos-login",eventId,role,code});
  const readableCode=(role)=>config?.codes?.[role]?.code||revealed[role];
  const showLoginQr=async(role)=>{const code=readableCode(role);if(!code)return;const row=roleRows.find(r=>r.key===role);const dataUrl=await QRCode.toDataURL(loginQrPayload(role,code),{width:700,margin:2});const win=window.open("","_blank");if(!win){setError("Allow popups to open the QR code.");return;}win.document.write(`<title>Ref OS Login QR</title><body style="font-family:Arial;text-align:center;padding:32px"><h1>Ref OS</h1><h2>${row?.label||role}</h2><img src="${dataUrl}" style="width:min(80vw,500px)"><div style="font-size:38px;font-weight:800;letter-spacing:8px">${code}</div><p>Scan from the Ref OS login screen</p></body>`);win.document.close();};
  const printLoginCards=async()=>{const available=roleRows.filter(r=>readableCode(r.key));if(!available.length){setError("Generate new role codes first.");return;}const cards=await Promise.all(available.map(async r=>{const code=readableCode(r.key);return {...r,code,qr:await QRCode.toDataURL(loginQrPayload(r.key,code),{width:500,margin:2})};}));const win=window.open("","_blank");if(!win){setError("Allow popups to print volunteer login cards.");return;}win.document.write(`<title>Ref OS Volunteer Login Cards</title><style>@page{size:letter;margin:.35in}body{font-family:Arial}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:2px solid #0D0F32;border-radius:18px;padding:22px;text-align:center;break-inside:avoid}.card img{width:210px;max-width:80%}.code{font-size:34px;font-weight:900;letter-spacing:7px}.role{font-size:22px;font-weight:800}.small{font-size:12px;color:#555}@media print{button{display:none}}</style><button onclick="window.print()">Print</button><div class="grid">${cards.map(c=>`<div class="card"><h2>Highlander Summit</h2><div class="role">${c.label}</div><img src="${c.qr}"><div class="code">${c.code}</div><p class="small">Open Ref OS and tap Scan QR code</p></div>`).join("")}</div>`);win.document.close();};

  const activeCount = roleRows.filter((r) => config?.codes?.[r.key]?.enabled).length;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-3 bg-[#0D0F32] text-white flex items-center gap-2">
        <KeyRound size={20}/>
        <div>
          <h2 className="font-bold">Volunteer Access Codes</h2>
          <p className="text-xs text-slate-400">4 character event day login codes</p>
        </div>
        <button onClick={onClose} className="ml-auto"><X size={22}/></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-3">
          <div className="rounded-xl border bg-white dark:bg-slate-800 p-4">
            <div className="font-bold">Event day access</div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Generate a different code for each volunteer role. Every code follows number, letter, number, number using A, B, C, or D. Admins continue using the normal Admin password.
            </p>
            <div className="mt-3 text-sm"><b>{activeCount}</b> of {roleRows.length} role codes active</div>
          </div>

          {roleRows.map((role) => {
            const saved = config?.codes?.[role.key];
            const active = !!saved?.enabled;
            const visibleCode = saved?.code || revealed[role.key];
            return (
              <div key={role.key} className="rounded-xl border bg-white dark:bg-slate-800 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{role.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{role.description}</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"}`}>
                    {active ? "ACTIVE" : "OFF"}
                  </span>
                </div>

                {visibleCode ? (
                  <div className="mt-4 rounded-xl bg-slate-100 dark:bg-slate-900 p-4 text-center">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Share this code</div>
                    <div className="text-4xl font-black tracking-[0.3em] pl-[0.3em] mt-1">{visibleCode}</div>
                    <div className="mt-3 flex flex-wrap justify-center gap-2"><button onClick={() => copyCode(role.key)} className="px-3 py-2 rounded-lg border text-sm font-semibold inline-flex items-center gap-2"><Copy size={15}/> Copy code</button><button onClick={() => showLoginQr(role.key)} className="px-3 py-2 rounded-lg border text-sm font-semibold inline-flex items-center gap-2"><QrCode size={15}/> Show QR</button></div>
                  </div>
                ) : active ? (
                  <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed p-3 text-sm text-slate-500 dark:text-slate-400">
                    This older active code was created before visible code storage was enabled. Generate a new code once to display it on every admin device.
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button disabled={!!busyRole} onClick={() => generate(role.key)}
                    className="rounded-xl bg-[#0D0F32] text-white py-2.5 px-3 font-semibold disabled:opacity-50">
                    {busyRole === role.key ? "Generating…" : active ? "Generate new code" : "Generate code"}
                  </button>
                  <button disabled={!!busyRole || !active} onClick={() => disable(role.key)}
                    className="rounded-xl border border-red-200 text-red-700 dark:text-red-300 py-2.5 px-3 font-semibold disabled:opacity-40">
                    Disable
                  </button>
                </div>
              </div>
            );
          })}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

          <button onClick={printLoginCards} className="w-full rounded-xl bg-[#0D0F32] text-white py-3 font-semibold flex items-center justify-center gap-2"><QrCode size={17}/> Print volunteer login cards</button>

          <button disabled={!!busyRole || !activeCount} onClick={disableAll}
            className="w-full rounded-xl border border-red-300 text-red-700 dark:text-red-300 py-3 font-semibold disabled:opacity-40">
            Disable all volunteer codes
          </button>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Codes are shared for this event and remain visible to administrators while Admin mode is active.
          </div>
        </div>
      </div>
    </div>
  );
}
