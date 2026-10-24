import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
const out='browser-extension/build';await mkdir(out,{recursive:true});
await build({entryPoints:['browser-extension/background.js','browser-extension/popup.js'],outdir:out,bundle:true,format:'esm',platform:'browser',target:'chrome116'});
for(const file of ['manifest.json','content.js','popup.html','popup.css','offscreen.html','offscreen.js','field-frame.html','field-frame.js'])await copyFile(`browser-extension/${file}`,`${out}/${file}`);
await copyFile('public/icon-192.png',`${out}/icon.png`);
console.log('Chrome extension prepared in '+out);

await copyFile('browser-extension/README.md',`${out}/README.md`);
// Small, dependency-free ZIP writer (stored entries, standard CRC32).
const files=['background.js','popup.js','manifest.json','content.js','popup.html','popup.css','offscreen.html','offscreen.js','field-frame.html','field-frame.js','icon.png','README.md'];
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let value=0xffffffff;for(const byte of bytes)value=table[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
const local=[],central=[];let offset=0;
for(const file of files){
 const name=Buffer.from(file),bytes=await readFile(`${out}/${file}`),sum=crc(bytes);
 const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(sum,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
 const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt32LE(sum,16);entry.writeUInt32LE(bytes.length,20);entry.writeUInt32LE(bytes.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
 local.push(header,name,bytes);central.push(entry,name);offset+=header.length+name.length+bytes.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
await writeFile('public/Ref-OS-TM-Extension.zip',Buffer.concat([...local,directory,end]));
console.log('Chrome extension ZIP: public/Ref-OS-TM-Extension.zip');
