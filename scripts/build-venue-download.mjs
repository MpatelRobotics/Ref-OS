import {readdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
const files=[];
for(const name of ['server.mjs','store.mjs','validate.mjs','setup-page.mjs','package.json','start-venue-server.cmd'])files.push({name:'venue-server/'+name,path:'venue-server/'+name});
files.push({name:'START-HERE.txt',path:'venue-server/DOWNLOAD-INSTRUCTIONS.txt'});
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())await walk(path);else if(!/\.(zip|exe|apk|map)$/i.test(item.name))files.push({name:path,path});}}
await walk('dist');
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
const local=[],central=[];let offset=0;
for(const file of files){
 const name=Buffer.from(file.name),raw=await readFile(file.path),bytes=deflateRawSync(raw),sum=crc(raw);
 const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);header.writeUInt32LE(sum,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(8,10);entry.writeUInt32LE(sum,16);entry.writeUInt32LE(bytes.length,20);entry.writeUInt32LE(raw.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
 local.push(header,name,bytes);central.push(entry,name);offset+=header.length+name.length+bytes.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await writeFile('public/Ref-OS-Venue-Server.zip',Buffer.concat([...local,directory,end]));
await copyFile('public/Ref-OS-Venue-Server.zip','dist/Ref-OS-Venue-Server.zip');
console.log('Venue server download ready. '+files.length+' files; no event data or private configuration included.');
