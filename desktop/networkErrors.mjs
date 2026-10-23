export function connectionFailure(error, stage = 'website') {
 const code = String(error?.code || error?.message || '').match(/(?:net::)?(ERR_[A-Z_]+)|\b(EACCES|EPERM|EADDRINUSE)\b/)?.[0]?.replace('net::','') || 'CONNECTION_FAILED';
 let help = 'Try the same website in Chrome on this computer. If Chrome works, ask school IT to allow Ref OS TM Connect.';
 if (code.includes('CERT_') || code.includes('SSL_')) help = 'The secure connection could not be verified. Ask school IT to check its filtering certificate and trust configuration for Ref OS TM Connect.';
 else if (/PROXY|TUNNEL/.test(code)) help = 'The school proxy could not connect or needs authentication. Ask school IT to approve Ref OS TM Connect and its Windows proxy settings.';
 else if (/NAME_NOT_RESOLVED|INTERNET_DISCONNECTED/.test(code)) help = 'Check this computer’s connection and school DNS settings.';
 else if (code === 'ERR_ABORTED') help = 'The website navigation was interrupted. Use its final HTTPS address from Chrome. School sign-in or filtering redirects may need IT approval.';
 else if (stage === 'local') help = 'The local connector could not start. Ask school IT to allow this application to use a local loopback connection.';
 return `Could not open Ref OS (${code}). ${help}`;
}
