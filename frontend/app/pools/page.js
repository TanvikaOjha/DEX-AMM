// app/pools/page.js
"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import { ADDRESSES, PAIR_ABI, TOKEN_ABI, RPC_URL } from "../lib/contract";

const POOL_DEFS = [
  { label: "TKA / TKB", pair: ADDRESSES.pairAB, t0: "TKA", t1: "TKB" },
  { label: "TKB / TKC", pair: ADDRESSES.pairBC, t0: "TKB", t1: "TKC" },
  { label: "TKA / TKC", pair: ADDRESSES.pairAC, t0: "TKA", t1: "TKC" },
];

function fmt(b, d = 2) {
  try {
    return parseFloat(ethers.formatEther(b || 0n)).toFixed(d);
  } catch {
    return "0.00";
  }
}

export default function PoolsPage() {
  const [pools, setPools] = useState([]);

  useEffect(() => {
    (async () => {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const results = await Promise.all(
        POOL_DEFS.map(async (p) => {
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
    <div className="text-gray-100 min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1a102f_0%,#09050f_60%,#030205_100%)] font-sans antialiased">
      <Nav account={account} onConnect={connect}/>
      
      {/* Hero Strip Header */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8 text-center space-y-4">
        <div className="inline-flex items-center bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-xs text-purple-300 font-medium tracking-wide uppercase">
          All Markets
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Liquidity <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-400">Pools</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Monitor depth metrics across active algorithmic pairs. Supply dual inventory balances to secure proportional fee cuts based on system layout activity.
        </p>
      </div>

      {/* Main Core Shell List Wrapper */}
      <div className="max-w-xl mx-auto px-4 pb-24 space-y-3">
        {pools.length === 0 ? (
          // Skeleton Loader placeholder state
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-[#130d22]/50 border border-purple-950/40 rounded-2xl" />
            ))}
          </div>
        ) : (
          pools.map((p) => (
            <div 
              key={p.label} 
              className="bg-[#130d22]/90 border border-purple-900/40 hover:border-purple-500/30 rounded-2xl px-6 py-5 flex flex-wrap justify-between items-center gap-4 transition duration-300 backdrop-blur-xl shadow-sm"
            >
              {/* Asset Pair Information Meta block */}
              <div>
                <div className="text-base font-bold text-white tracking-tight">
                  {p.label}
                </div>
                <div className="text-xs text-gray-400 font-mono mt-1">
                  1 {p.t0} = <span className="text-purple-300 font-semibold">{p.price}</span> {p.t1}
                </div>
              </div>

              {/* Reserve Metric Stats Readout */}
              <div className="flex gap-8">
                <div className="text-right space-y-0.5">
                  <div className="font-mono text-base font-bold text-[#7CFFB2]">
                    {fmt(p.r0)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    {p.t0} Reserve
                  </div>
                </div>
                
                <div className="text-right space-y-0.5">
                  <div className="font-mono text-base font-bold text-[#FF8A65]">
                    {fmt(p.r1)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    {p.t1} Reserve
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}