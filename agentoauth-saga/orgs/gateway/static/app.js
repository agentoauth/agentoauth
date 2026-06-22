// SPDX-License-Identifier: MIT
"use strict";

/* ---------- WebCrypto verification (reused from the saga viewer) ---------- */
function b64urlToBytes(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";
  const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
function decodeJSON(b){return JSON.parse(new TextDecoder().decode(b64urlToBytes(b)));}
async function verifyJWS(compact, keys){
  if(!compact||!(window.crypto&&crypto.subtle))return null;
  let header; try{header=decodeJSON(compact.split(".")[0]);}catch(e){return false;}
  const p=compact.split(".");if(p.length!==3)return false;
  const data=new TextEncoder().encode(p[0]+"."+p[1]);const sig=b64urlToBytes(p[2]);
  const ordered=keys.slice().sort((a,b)=>(a&&a.kid===header.kid?-1:0)-(b&&b.kid===header.kid?-1:0));
  for(const jwk of ordered){ if(!jwk)continue;
    try{const k=await crypto.subtle.importKey("jwk",{kty:jwk.kty,crv:jwk.crv,x:jwk.x},{name:"Ed25519"},false,["verify"]);
      if(await crypto.subtle.verify({name:"Ed25519"},k,sig,data))return true;}catch(e){}}
  return false;
}
async function sha256Hex(str){
  const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
  return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function setActive(el){document.querySelectorAll(".org").forEach(o=>o.classList.remove("active"));if(el)el.classList.add("active");}
function lit(id){$(id).classList.add("lit");}
function clearStage(){
  document.querySelectorAll(".box").forEach(b=>b.classList.remove("lit"));
  document.querySelectorAll(".org").forEach(o=>o.classList.remove("active"));
  ["a-build-v","a-sign-v","a-verify-v","b-recv-v","b-policy-v","b-crew-v","b-sign-v"].forEach(i=>$(i).innerHTML="—");
  $("sig1").textContent="—";$("sig2").textContent="—";$("tokenjson").textContent="—";$("receiptjson").textContent="—";
  $("bind").textContent="binding: —";$("final").style.display="none";
  badge("sig1badge","wait","○ awaiting run");badge("sig2badge","wait","○ awaiting run");
}
function badge(id,cls,txt){const e=$(id);e.className="badge "+cls;e.textContent=txt;}
function flyPacket(cls,dir,label){
  const w=$("wire");const p=document.createElement("div");
  p.className="packet "+cls+" "+(dir==="right"?"go-right":"go-left");p.textContent=label;
  w.appendChild(p);setTimeout(()=>p.remove(),1300);
}

/* ---------- state ---------- */
let scenario="success", trace=null, steps=[], idx=0, running=false;

async function fetchTrace(sc){
  const replay=$("replay").checked;
  if(!replay){
    try{
      const r=await fetch("/api/handshake",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({scenario:sc})});
      if(r.ok)return await r.json();
    }catch(e){/* fall through to replay */}
  }
  const r=await fetch("traces/"+sc+".json");
  if(!r.ok)throw new Error("no trace available for "+sc);
  return await r.json();
}

/* ---------- the step sequence (built from the real trace) ---------- */
function buildSteps(t){
  const req=t.request, v=t.verify, c=t.crew, denied=v.verdict==="DENY";
  return [
    {chip:"build order", run:async()=>{setActive($("orgA"));lit("a-build");
      $("a-build-v").innerHTML=`order.place · ${req.sku}<br>amount ${req.amount} ${req.currency} · limit ≤ ${req.max_amount}`;}},
    {chip:"sign token (Sig 1)", run:async()=>{lit("a-sign");
      $("a-sign-v").innerHTML=`signed EdDSA · agent <code>${t.buyer.agent_id||"buyer@org-a"}</code>`;
      $("sig1").textContent=t.token.signature||"—";
      $("tokenjson").textContent=JSON.stringify(t.token.decoded||t.token.model,null,2);
      const ok=await verifyJWS(t.token.signature,[t.token.agent_jwk]);
      badge("sig1badge",ok?"ok":"bad",(ok?"✓ Signature 1 VALID":"✗ INVALID")+" · verified in your browser");}},
    {chip:"→ A2A", run:async()=>{flyPacket("sig1","right","Consent Token + Sig 1 →");await sleep(700);}},
    {chip:"check agent sig", run:async()=>{setActive($("orgB"));lit("b-recv");
      $("b-recv-v").innerHTML=`token extracted from A2A metadata<br><span class="check">✓ agent signature checked</span>`;}},
    {chip:"policy verdict", run:async()=>{lit("b-policy");
      const basis=(v.decision_basis||[]).map(b=>`<div>• ${b}</div>`).join("");
      $("b-policy-v").innerHTML=`<span class="verdict ${v.verdict}">${v.verdict}</span> `+
        `quote ${v.quoted_price} vs limit ${v.max_amount}<div class="basis">${basis}</div>`;}},
    {chip:denied?"denied":"crew reasons", run:async()=>{lit("b-crew");
      $("b-crew-v").innerHTML= denied
        ? `<span class="cross">not reached</span> — denied on authority before fulfilment`
        : `used_llm=${c.used_llm} · ${c.category}<br><i>${c.reasoning||""}</i>`;}},
    {chip:"sign receipt (Sig 2)", run:async()=>{lit("b-sign");
      $("b-sign-v").innerHTML=`verifier signs receipt · decision <b>${c.category}</b>`;
      $("sig2").textContent=t.receipt.signature||"—";
      $("receiptjson").textContent=JSON.stringify(t.receipt.decoded||t.receipt.model,null,2);}},
    {chip:"← A2A", run:async()=>{flyPacket("sig2","left","← Consent Receipt + Sig 2");await sleep(700);}},
    {chip:"verify receipt (Sig 2)", run:async()=>{setActive($("orgA"));lit("a-verify");
      const ok=await verifyJWS(t.receipt.signature,[t.receipt.verifier_jwk]);
      badge("sig2badge",ok?"ok":"bad",(ok?"✓ Signature 2 VALID":"✗ INVALID")+" · verified in your browser");
      // binding: receipt.consent_token_hash == sha256(token signature)
      let bindOk=false,computed="";
      if(t.token.signature&&t.receipt.consent_token_hash){
        computed="sha256:"+await sha256Hex(t.token.signature);
        bindOk=(computed===t.receipt.consent_token_hash);
      }
      $("bind").innerHTML=`binding: receipt.consent_token_hash ${bindOk?'<span class="check">✓ matches</span>':'<span class="cross">✗</span>'} sha256(token)`;
      $("a-verify-v").innerHTML=`<span class="${ok?'check':'cross'}">${ok?'✓ receipt signature valid':'✗ invalid'}</span> · `+
        `<span class="${bindOk?'check':'cross'}">${bindOk?'bound to this token':'binding broken'}</span>`;}},
    {chip:"outcome", run:async()=>{setActive(null);
      const f=$("final");f.style.display="block";f.className="final "+t.a2a_state;
      f.innerHTML=`A2A task: <b>${t.a2a_state}</b> · verdict <span class="verdict ${v.verdict}">${v.verdict}</span> · `+
        `decision <b>${c.category}</b>${t.receipt.executed?' · order placed':''}`;}},
  ];
}

function renderRail(){
  const rail=$("rail");rail.innerHTML="";
  steps.forEach((s,i)=>{const c=document.createElement("span");
    c.className="chip"+(i<idx?" done":"")+(i===idx?" cur":"");c.textContent=(i+1)+" "+s.chip;rail.appendChild(c);});
}

async function loadScenario(sc){
  scenario=sc;running=false;idx=0;clearStage();
  $("rail").innerHTML='<span class="chip">loading real handshake…</span>';
  try{trace=await fetchTrace(sc);}catch(e){$("rail").innerHTML='<span class="chip">error: '+e.message+'</span>';return;}
  steps=buildSteps(trace);idx=0;renderRail();
}

async function stepOnce(){
  if(!steps.length||idx>=steps.length)return;
  await steps[idx].run();idx++;renderRail();
}
async function runAll(){
  if(running)return;running=true;
  if(idx>=steps.length){idx=0;clearStage();steps=buildSteps(trace);}
  while(idx<steps.length){await stepOnce();await sleep(820);}
  running=false;
}

/* ---------- wiring ---------- */
$("scenarios").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  document.querySelectorAll("#scenarios button").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");loadScenario(b.dataset.sc);});
$("run").addEventListener("click",runAll);
$("step").addEventListener("click",stepOnce);
$("reset").addEventListener("click",()=>{idx=0;running=false;clearStage();steps=buildSteps(trace);renderRail();});
$("replay").addEventListener("change",()=>loadScenario(scenario));

loadScenario("success");
