export function connectionDetails(error, stage = 'website') {
 const code = String(error?.code || error?.message || '').match(/(?:net::)?(ERR_[A-Z_]+)|\b(EACCES|EPERM|EADDRINUSE)\b/)?.[0]?.replace('net::','') || 'CONNECTION_FAILED';
 let title='The connector could not reach Ref OS';
 let steps=['Open Ref OS in your browser on this computer to check website access.', 'If the browser works, ask school IT to allow Ref OS TM Connect through its network filter.'];
 let proxy=false;
 if(stage==='local'){
  title='The local TM connector could not start';
  steps=['Close other copies of Ref OS TM Connect and retry.', 'If it still fails, ask school IT to allow local loopback connections for this application.'];
 }else if(/CERT_|SSL_/.test(code)){
  title='The secure connection could not be verified';
  steps=['Check the computer’s date and time.', 'Ask school IT to check its web-filter certificate and trust configuration for Ref OS TM Connect. Do not turn off certificate checking.'];
 }else if(/PROXY|TUNNEL/.test(code)){
  title='The school proxy could not complete the connection';proxy=true;
  steps=['Open Windows proxy settings and check them with school IT.', 'If the network needs a school sign-in, complete it in your browser and retry.', 'Ask school IT to approve this application for its proxy.'];
 }else if(code==='ERR_NAME_NOT_RESOLVED'){
  title='The website address could not be found';
  steps=['Check the website address for typing mistakes.', 'Reconnect to the school network and retry.', 'If Chrome opens the same address, ask school IT to check DNS or application filtering.'];
 }else if(code==='ERR_INTERNET_DISCONNECTED'){
  title='This computer has no available internet connection';
  steps=['Reconnect Wi-Fi or Ethernet.', 'Complete any school network sign-in in your browser, then retry.'];
 }else if(code==='ERR_ABORTED'){
  title='Opening the website was interrupted';
  steps=['Open Ref OS in your browser and check the final HTTPS address.', 'If the school redirects to a sign-in or filtering page, ask IT to approve access for the connector.', 'Retry after the network sign-in is complete.'];
 }else if(/TIMED_OUT|CONNECTION_RESET|CONNECTION_REFUSED|BLOCKED/.test(code)){
  title='The connection was blocked, interrupted or refused';proxy=true;
  steps=['Retry the connection.', 'Open Ref OS in your browser on this computer.', 'If the browser works, ask school IT to check its firewall, proxy or application-filtering rules for Ref OS TM Connect.'];
 }
 return {code,title,steps,proxy};
}
export function connectionFailure(error, stage='website') {
 const info=connectionDetails(error,stage);
 return `${info.title} (${info.code}). ${info.steps.join(' ')}`;
}
