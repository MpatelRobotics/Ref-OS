import React, { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";
import { Camera, RefreshCw, ScanSearch, X } from "lucide-react";

const SIZE = 256;
const CLASSES = ["Pin", "Cup", "Goal", "Toggle"];

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function iou(a,b) {
  const x1=Math.max(a.x1,b.x1), y1=Math.max(a.y1,b.y1), x2=Math.min(a.x2,b.x2), y2=Math.min(a.y2,b.y2);
  const inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);
  return inter / Math.max(1e-6,(a.x2-a.x1)*(a.y2-a.y1)+(b.x2-b.x1)*(b.y2-b.y1)-inter);
}
function nms(items, threshold=.42) {
  const sorted=[...items].sort((a,b)=>b.score-a.score), keep=[];
  while(sorted.length) {
    const best=sorted.shift(); keep.push(best);
    for(let i=sorted.length-1;i>=0;i--) if(sorted[i].classId===best.classId && iou(best,sorted[i])>threshold) sorted.splice(i,1);
  }
  return keep.slice(0,40);
}

export default function LiveFieldSetupCheck({ onClose }) {
  const videoRef=useRef(null), streamRef=useRef(null), canvasRef=useRef(null), sessionRef=useRef(null), busyRef=useRef(false);
  const [error,setError]=useState(""), [ready,setReady]=useState(false), [modelReady,setModelReady]=useState(false);
  const [detections,setDetections]=useState([]), [threshold,setThreshold]=useState(.65), [fps,setFps]=useState(0);

  async function startCamera() {
    setError(""); setReady(false);
    try {
      streamRef.current?.getTracks?.().forEach(t=>t.stop());
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
      streamRef.current=stream; videoRef.current.srcObject=stream; await videoRef.current.play(); setReady(true);
    } catch(e) { setError(e?.message || "Camera access failed."); }
  }

  useEffect(()=>{ startCamera(); return()=>streamRef.current?.getTracks?.().forEach(t=>t.stop()); },[]);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try {
        ort.env.wasm.wasmPaths="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
        const session=await ort.InferenceSession.create("/models/refos_tiny_detector.onnx",{executionProviders:["wasm"]});
        if(alive){ sessionRef.current=session; setModelReady(true); }
      } catch(e){ if(alive) setError(`Detector model failed to load: ${e?.message||e}`); }
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!ready || !modelReady) return;
    let timer;
    const run=async()=>{
      if(busyRef.current){ timer=setTimeout(run,120); return; }
      const v=videoRef.current,c=canvasRef.current,s=sessionRef.current;
      if(!v||!c||!s||v.readyState<2){ timer=setTimeout(run,200); return; }
      busyRef.current=true; const started=performance.now();
      try {
        c.width=SIZE;c.height=SIZE; const ctx=c.getContext("2d",{willReadFrequently:true});
        ctx.drawImage(v,0,0,SIZE,SIZE); const px=ctx.getImageData(0,0,SIZE,SIZE).data;
        const input=new Float32Array(3*SIZE*SIZE);
        for(let i=0;i<SIZE*SIZE;i++){ input[i]=px[i*4]/255; input[SIZE*SIZE+i]=px[i*4+1]/255; input[2*SIZE*SIZE+i]=px[i*4+2]/255; }
        const feeds={}; feeds[s.inputNames[0]]=new ort.Tensor("float32",input,[1,3,SIZE,SIZE]);
        const outputs=await s.run(feeds), out=outputs[s.outputNames[0]], d=out.data, dims=out.dims;
        const H=dims[dims.length-2], W=dims[dims.length-1], stride=H*W, found=[];
        for(let y=0;y<H;y++) for(let x=0;x<W;x++){
          const idx=y*W+x;
          const obj=sigmoid(d[idx]);
          if(obj<threshold*.65) continue;

          let maxLogit=-Infinity;
          for(let k=0;k<4;k++) maxLogit=Math.max(maxLogit,d[(1+k)*stride+idx]);
          const probs=[];
          let denom=0;
          for(let k=0;k<4;k++) { const e=Math.exp(d[(1+k)*stride+idx]-maxLogit); probs.push(e); denom+=e; }
          let cid=0,cp=0;
          for(let k=0;k<4;k++) { const p=probs[k]/Math.max(1e-9,denom); if(p>cp){cp=p;cid=k;} }

          const score=obj*cp;
          if(score<threshold) continue;

          const cx=(sigmoid(d[5*stride+idx])+x)/W;
          const cy=(sigmoid(d[6*stride+idx])+y)/H;
          const bw=Math.min(1,sigmoid(d[7*stride+idx]));
          const bh=Math.min(1,sigmoid(d[8*stride+idx]));
          found.push({classId:cid,label:CLASSES[cid],score,x1:Math.max(0,cx-bw/2),y1:Math.max(0,cy-bh/2),x2:Math.min(1,cx+bw/2),y2:Math.min(1,cy+bh/2)});
        }
        setDetections(nms(found)); setFps(1000/Math.max(1,performance.now()-started));
      } catch(e){ setError(`Detection error: ${e?.message||e}`); }
      finally { busyRef.current=false; timer=setTimeout(run,100); }
    };
    run(); return()=>clearTimeout(timer);
  },[ready,modelReady,threshold]);

  return <div className="fixed inset-0 z-[100] bg-black flex flex-col text-white">
    <div className="shrink-0 px-3 py-3 bg-[#0D0F32] flex items-center gap-2 border-b border-white/10">
      <Camera size={19}/><div className="min-w-0 flex-1"><div className="font-bold">Live Field Setup Check</div>
      <div className="text-[11px] text-slate-300">ADMIN TEST • V2 ground-truth ONNX detector</div></div>
      <button onClick={onClose} className="p-2" aria-label="Close"><X size={22}/></button>
    </div>
    <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-fill"/>
      {detections.map((d,i)=><div key={`${d.classId}-${i}`} className="absolute border-2 border-emerald-400 pointer-events-none"
        style={{left:`${d.x1*100}%`,top:`${d.y1*100}%`,width:`${(d.x2-d.x1)*100}%`,height:`${(d.y2-d.y1)*100}%`}}>
        <div className="absolute left-0 -top-6 bg-emerald-500 text-black text-[11px] font-bold px-1.5 py-1 whitespace-nowrap">{d.label.toUpperCase()} {Math.round(d.score*100)}%</div>
      </div>)}
      <div className="absolute left-3 top-3 bg-black/80 px-2.5 py-1.5 rounded-md text-xs font-bold">
        {ready?"CAMERA ✓":"CAMERA…"} • {modelReady?"MODEL ✓":"MODEL…"} • {detections.length} objects • {fps.toFixed(1)} FPS
      </div>
      {error&&<div className="absolute inset-x-3 bottom-3 bg-red-950/95 border border-red-500 p-3 rounded-md text-sm">{error}</div>}
      <canvas ref={canvasRef} className="hidden"/>
    </div>
    <div className="shrink-0 bg-[#0D0F32] border-t border-white/10 p-3 space-y-3">
      <div className="flex items-center gap-3"><ScanSearch size={17}/><label className="text-xs flex-1">Confidence {Math.round(threshold*100)}%
        <input type="range" min="20" max="85" value={Math.round(threshold*100)} onChange={e=>setThreshold(Number(e.target.value)/100)} className="w-full mt-1"/>
      </label></div>
      <button onClick={startCamera} className="w-full rounded-md border border-white/20 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"><RefreshCw size={16}/>Restart camera</button>
      <div className="text-[11px] text-amber-100">Experimental V2 ground-truth detector fine-tuned with human-confirmed Pin, Cup, Goal, and Toggle photos plus prior CAD and real-field training. Verify detections manually before making event decisions.</div>
    </div>
  </div>;
}
