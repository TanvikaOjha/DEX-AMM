"use client";
import { useEffect, useState } from "react";
import { ethers }             from "ethers";
import Nav                   from "../../components/Nav";
import { ADDRESSES, PAIR_ABI, TOKEN_ABI, RPC_URL } from "../../lib/contracts";

const POOL_DEFS = [
  { label:"TKA / TKB", pair:ADDRESSES.pairAB, t0:"TKA", t1:"TKB" },
  { label:"TKB / TKC", pair:ADDRESSES.pairBC, t0:"TKB", t1:"TKC" },
  { label:"TKA / TKC", pair:ADDRESSES.pairAC, t0:"TKA", t1:"TKC" },
];

function fmt(b, d=2) {
  try { return parseFloat(ethers.formatEther(b||0n)).toFixed(d); } catch { return "0.00"; }
}

export default function PoolsPage() {
  const [pools, setPools] = useState([]);

  useEffect(() => {
    (async() => {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const results  = await Promise.all(
        POOL_DEFS.map(async p => {
          const pair = new ethers.Contract(p.pair, PAIR_ABI, provider);
          const [r0, r1] = await Promise.all([pair.reserve0(), pair.reserve1()]);
          const price = r0 > 0n
            ? (Number(ethers.formatEther(r1)) / Number(ethers.formatEther(r0))).toFixed(4)
            : "—";
          return { ...p, r0, r1, price };
        })
      );
      setPools(results);
    })();
  }, []);

  return (
    <>
      <Nav />
      <div className="hero-strip">
        <div className="hero-eyebrow">All Markets</div>
        <h1 className="hero-title">Liquidity <span className="accent">Pools</span></h1>
        <p className="hero-sub">Three active pools. Add liquidity to earn 0.3% on every swap routed through your share.</p>
      </div>
      <div className="shell">
        {pools.map(p => (
          <div key={p.label} style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:"16px",padding:"20px 24px",marginBottom:"12px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"}}>
            <div>
              <div style={{fontFamily:"var(--display)",fontWeight:700,fontSize:"15px"}}>{p.label}</div>
              <div style={{fontSize:"12px",color:"var(--muted)",marginTop:"4px"}}>1 {p.t0} = {p.price} {p.t1}</div>
            </div>
            <div style={{display:"flex",gap:"28px"}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"var(--display)",color:"#7CFFB2"}}>{fmt(p.r0)}</div>
                <div style={{fontSize:"10px",color:"var(--faint)"}}>{p.t0} reserve</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"var(--display)",color:"#FF8A65"}}>{fmt(p.r1)}</div>
                <div style={{fontSize:"10px",color:"var(--faint)"}}>{p.t1} reserve</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}