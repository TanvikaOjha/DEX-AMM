// app/pool/page.js
"use client";

import { useState, useMemo } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import { useWallet } from "../hooks/useWallet";
import { useAMM } from "../hooks/useAMM";
import { ADDRESSES, TOKEN_LABELS, PAIR_ABI, TOKEN_ABI } from "../lib/contract";

function fmt(bigint, dec = 4) {
  try {
    return parseFloat(ethers.formatEther(bigint || 0n)).toFixed(dec);
  } catch {
    return "0.0000";
  }
}

export default function PoolPage() {
  const { account, signer, connect } = useWallet();
  const { reserves, lpBalance, lpTotalSupply, refresh } = useAMM(account);

  const [mode, setMode] = useState("add"); // "add" | "remove"
  const [amtA, setAmtA] = useState("");
  const [amtB, setAmtB] = useState("");
  const [removePct, setRemovePct] = useState(50);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const labelA = TOKEN_LABELS[ADDRESSES.tokenA] || "TKA";
  const labelB = TOKEN_LABELS[ADDRESSES.tokenB] || "TKB";

  const poolSharePct = useMemo(() => {
    if (!lpTotalSupply || lpTotalSupply === 0n) return 0;
    return Number((lpBalance * 10000n) / lpTotalSupply) / 100;
  }, [lpBalance, lpTotalSupply]);

  function handleAmtAChange(v) {
    setAmtA(v);
    if (reserves.r0 > 0n && v) {
      try {
        const a = ethers.parseEther(v);
        const autoB = (a * reserves.r1) / reserves.r0;
        setAmtB(ethers.formatEther(autoB));
      } catch {}
    }
  }

  async function handleAdd() {
    if (!signer) return setStatus({ type: "error", msg: "Connect your wallet first." });
    setBusy(true);
    setStatus(null);
    try {
      const a = ethers.parseEther(amtA);
      const b = ethers.parseEther(amtB);
      const tA = new ethers.Contract(ADDRESSES.tokenA, TOKEN_ABI, signer);
      const tB = new ethers.Contract(ADDRESSES.tokenB, TOKEN_ABI, signer);
      const pair = new ethers.Contract(ADDRESSES.pair, PAIR_ABI, signer);

      setStatus({ type: "info", msg: `Approving ${labelA}…` });
      await (await tA.approve(ADDRESSES.pair, a)).wait();

      setStatus({ type: "info", msg: `Approving ${labelB}…` });
      await (await tB.approve(ADDRESSES.pair, b)).wait();

      setStatus({ type: "info", msg: "Adding liquidity…" });
      await (await pair.addLiquidity(a, b, 0, 0, account)).wait();

      setStatus({ type: "success", msg: "✓ Liquidity added — LP tokens minted to your wallet." });
      setAmtA(""); setAmtB("");
      refresh();
    } catch (e) {
      setStatus({ type: "error", msg: e.reason || e.message || "Transaction failed." });
    }
    setBusy(false);
  }

  async function handleRemove() {
    if (!signer || lpBalance === 0n) return;
    setBusy(true);
    setStatus(null);
    try {
      const pair = new ethers.Contract(ADDRESSES.pair, PAIR_ABI, signer);
      const lpAddr = await pair.lpToken();
      const lpAbi = ["function approve(address,uint256) returns (bool)"];
      const lpContract = new ethers.Contract(lpAddr, lpAbi, signer);

      const amount = (lpBalance * BigInt(removePct)) / 100n;

      setStatus({ type: "info", msg: "Approving LP tokens…" });
      await (await lpContract.approve(ADDRESSES.pair, amount)).wait();

      setStatus({ type: "info", msg: "Removing liquidity…" });
      await (await pair.removeLiquidity(amount, 0, 0, account)).wait();

      setStatus({ type: "success", msg: `✓ Removed ${removePct}% of your liquidity.` });
      refresh();
    } catch (e) {
      setStatus({ type: "error", msg: e.reason || e.message || "Transaction failed." });
    }
    setBusy(false);
  }

  return (
    <div className="text-gray-100 min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1a102f_0%,#09050f_60%,#030205_100%)] font-sans antialiased">
      <Nav account={account} onConnect={connect} />

      {/* Hero Header Strip */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8 text-center space-y-4">
        <div className="inline-flex items-center bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-xs text-purple-300 font-medium tracking-wide uppercase">
          Liquidity Provisioning
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Become the <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-400">Other Side</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Deposit asset pairs at current algorithmic equilibrium ratios to support exchange routing depth while capturing a 0.3% fee slice on active volume.
        </p>
      </div>

      <div className="max-w-md mx-auto px-4 pb-24 space-y-6">
        
        {/* Pool Live Statistics Row View */}
        <div className="grid grid-cols-3 gap-2 bg-[#0e0a1a]/60 border border-purple-950/40 rounded-2xl p-4 backdrop-blur-md text-center">
          <div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{fmt(reserves.r0, 1)}</div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider">{labelA} Pool</div>
          </div>
          <div className="border-x border-white/[0.04]">
            <div className="text-lg font-bold text-rose-400 font-mono">{fmt(reserves.r1, 1)}</div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider">{labelB} Pool</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-300 font-mono">{poolSharePct.toFixed(2)}%</div>
            <div className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider">Your Share</div>
          </div>
        </div>

        {/* Modular Action Component Mode Toggles */}
        <div className="flex bg-[#1c1430]/40 p-1 rounded-xl border border-white/[0.03]">
          <button 
            className={`w-1/2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "add" 
                ? "bg-purple-950 text-pink-400 shadow-sm border border-purple-900/40" 
                : "text-gray-400 hover:text-white"
            }`} 
            onClick={() => setMode("add")}
          >
            Add Liquidity
          </button>
          <button 
            className={`w-1/2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              mode === "remove" 
                ? "bg-purple-950 text-pink-400 shadow-sm border border-purple-900/40" 
                : "text-gray-400 hover:text-white"
            }`} 
            onClick={() => setMode("remove")}
          >
            Remove Liquidity
          </button>
        </div>

        {/* Central Card Assembly */}
        <div className="bg-[#130d22]/90 border border-purple-900/40 p-6 rounded-3xl backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.12)]">
          {mode === "add" ? (
            <div className="space-y-4">
              {/* Asset Box A Input */}
              <div className="bg-[#1c1430] p-4 rounded-2xl border border-white/5 focus-within:border-purple-500/50 transition">
                <div className="text-xs text-gray-400 mb-2">Deposit Amount</div>
                <div className="flex justify-between items-center gap-4">
                  <input
                    className="bg-transparent text-2xl font-bold w-2/3 outline-none focus:text-white text-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    type="number"
                    placeholder="0.0"
                    value={amtA}
                    onChange={(e) => handleAmtAChange(e.target.value)}
                  />
                  <div className="flex items-center space-x-2 bg-purple-950 border border-purple-800 text-white font-semibold px-3 py-1.5 rounded-xl text-sm select-none">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{labelA}</span>
                  </div>
                </div>
              </div>

              {/* Math Combinator Node Signpost */}
              <div className="flex justify-center -my-2 relative z-10 select-none">
                <div className="bg-[#1c1430] border-4 border-[#130d22] text-gray-500 w-8 h-8 flex items-center justify-center rounded-xl font-bold text-sm">
                  +
                </div>
              </div>

              {/* Asset Box B Input */}
              <div className="bg-[#1c1430] p-4 rounded-2xl border border-white/5 focus-within:border-purple-500/50 transition">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
                  <span>Deposit Amount</span>
                  <span className="text-[10px] text-purple-400 font-medium">Auto-filled via pricing invariant</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <input
                    className="bg-transparent text-2xl font-bold w-2/3 outline-none focus:text-white text-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    type="number"
                    placeholder="0.0"
                    value={amtB}
                    onChange={(e) => setAmtB(e.target.value)}
                  />
                  <div className="flex items-center space-x-2 bg-purple-950 border border-purple-800 text-white font-semibold px-3 py-1.5 rounded-xl text-sm select-none">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>{labelB}</span>
                  </div>
                </div>
              </div>

              {/* Add CTA */}
              <div className="pt-2">
                {!account ? (
                  <button onClick={connect} className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-2xl text-sm transition transform active:scale-[0.99] shadow-md">
                    Connect Wallet
                  </button>
                ) : (
                  <button
                    disabled={busy || !amtA || !amtB}
                    onClick={handleAdd}
                    className={`w-full font-bold py-4 rounded-2xl text-sm transition transform active:scale-[0.99] flex justify-center items-center ${
                      busy || !amtA || !amtB
                        ? "bg-purple-950/40 border border-purple-900/30 text-purple-400/60 cursor-not-allowed"
                        : "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg"
                    }`}
                  >
                    {busy ? (
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : "Add Liquidity"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Liquidity Burning Allocation Sliders */}
              <div className="bg-[#1c1430] p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
                  <span>Your Balance Allocation</span>
                  <span className="font-mono text-purple-300 font-semibold">{fmt(lpBalance)} ALP</span>
                </div>
                
                <div className="space-y-4 py-2">
                  <div className="text-3xl font-extrabold text-center text-white tracking-tight">
                    {removePct}%
                  </div>
                  <input
                    type="range" min="1" max="100" value={removePct}
                    className="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    onChange={(e) => setRemovePct(+e.target.value)}
                  />
                  <div className="flex justify-between gap-2 pt-1">
                    {[25, 50, 75, 100].map((p) => (
                      <button
                        key={p}
                        onClick={() => setRemovePct(p)}
                        className={`flex-1 py-1 text-xs font-semibold rounded-lg transition ${
                          removePct === p 
                            ? "bg-pink-500 text-white shadow-md" 
                            : "bg-purple-950/60 text-purple-300 hover:bg-purple-900/50"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estimated Token Payout Matrix Sheet */}
              <div className="bg-[#1c1430]/40 rounded-2xl p-4 border border-white/[0.02] space-y-2.5 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Returned {labelA} (Estimated)</span>
                  <span className="text-emerald-400 font-mono font-medium">
                    {fmt((reserves.r0 * lpBalance * BigInt(removePct)) / ((lpTotalSupply || 1n) * 100n))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Returned {labelB} (Estimated)</span>
                  <span className="text-rose-400 font-mono font-medium">
                    {fmt((reserves.r1 * lpBalance * BigInt(removePct)) / ((lpTotalSupply || 1n) * 100n))}
                  </span>
                </div>
              </div>

              {/* Remove CTA */}
              <div className="pt-2">
                {!account ? (
                  <button onClick={connect} className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-2xl text-sm transition transform active:scale-[0.99] shadow-md">
                    Connect Wallet
                  </button>
                ) : (
                  <button
                    disabled={busy || lpBalance === 0n}
                    onClick={handleRemove}
                    className={`w-full font-bold py-4 rounded-2xl text-sm transition transform active:scale-[0.99] flex justify-center items-center ${
                      busy || lpBalance === 0n
                        ? "bg-purple-950/40 border border-purple-900/30 text-purple-400/60 cursor-not-allowed"
                        : "bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg"
                    }`}
                  >
                    {busy ? (
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : lpBalance === 0n ? (
                      "No LP tokens to remove"
                    ) : (
                      `Remove ${removePct}% Liquidity`
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Operational Log Status Banner */}
          {status && (
            <div className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed ${
              status.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
              status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              'bg-purple-500/10 border-purple-500/20 text-purple-300'
            }`}>
              {status.msg}
            </div>
          )}
        </div>

        {/* Informational Callout Info Footer */}
        <div className="bg-[#0e0a1a]/40 border border-purple-950/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-gray-400 leading-relaxed">
          <span className="text-lg select-none">🎫</span>
          <div>
            LP shares token fractions document immutable underlying tracking index parameters. Liquidity positions are fully revocable at any stage to withdraw pooled inventory along with accrued modular network swap fees.
          </div>
        </div>

      </div>
    </div>
  );
}