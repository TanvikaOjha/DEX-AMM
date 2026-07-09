// app/page.js
"use client";

import { useState, useMemo, useEffect } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import CurveStage from "../components/CurveStage";
import { useWallet } from "../hooks/useWallet";
import { useAMM } from "../hooks/useAMM";
import {
  ADDRESSES, TOKENS, ROUTER_ABI, TOKEN_ABI, RPC_URL,
} from "../lib/contract";

// ── Helpers ──────────────────────────────────────────────────────
function fmt(bigint, dec = 4) {
  try { return parseFloat(ethers.formatEther(bigint || 0n)).toFixed(dec); } catch { return "0.0000"; }
}
function fmtImpact(pct) {
  if (pct < 0.01) return { text: "<0.01%", cls: "text-emerald-400" };
  if (pct < 1)    return { text: `${pct.toFixed(2)}%`, cls: "text-emerald-400" };
  if (pct < 3)    return { text: `${pct.toFixed(2)}%`, cls: "text-amber-400 font-medium" };
  return { text: `${pct.toFixed(2)}%`, cls: "text-rose-500 font-bold" };
}

const PERMIT_ABI = [
  "function nonces(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
];

export default function SwapPage() {
  const { account, signer, connect } = useWallet();
  const { reserves, token0Addr, twapPrice, getQuote, getPriceImpactPct, refresh } = useAMM(account);

  // Token selectors — default TKA → TKB
  const [tokenIn,  setTokenIn]  = useState(TOKENS[0]);
  const [tokenOut, setTokenOut] = useState(TOKENS[1]);

  const [amountIn,     setAmountIn]     = useState("");
  const [amountOutWei, setAmountOutWei] = useState(0n);
  const [bestPath,     setBestPath]     = useState([]);
  const [routeLabel,   setRouteLabel]   = useState("");
  const [slippage,     setSlippage]     = useState("0.5");
  const [usePermit,    setUsePermit]    = useState(false);
  const [swapping,     setSwapping]     = useState(false);
  const [status,       setStatus]       = useState(null);

  const amountInWei = useMemo(() => {
    try { return amountIn ? ethers.parseEther(amountIn) : 0n; } catch { return 0n; }
  }, [amountIn]);

  // Call getBestAmountOut on the router whenever input/tokens change
  useEffect(() => {
    if (!amountInWei || amountInWei <= 0n || !tokenIn?.address || !tokenOut?.address || tokenIn.address === tokenOut.address) {
      setAmountOutWei(0n); 
      setBestPath([]); 
      setRouteLabel(""); 
      return;
    }
    let cancelled = false;
    const fetchRoute = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const router   = new ethers.Contract(ADDRESSES.router, ROUTER_ABI, provider);
        // Use TKB as the intermediate token for A↔C hops
        const intermediate = ADDRESSES.tokenB;
        const [bestOut, path] = await router.getBestAmountOut(
          amountInWei, tokenIn.address, tokenOut.address, intermediate
        );
        if (cancelled) return;
        setAmountOutWei(bestOut);
        setBestPath(path);
        if (path.length === 2) setRouteLabel("Direct");
        else setRouteLabel(`Via ${TOKENS.find(t => t.address.toLowerCase() === path[1].toLowerCase())?.label || "…"}`);
      } catch (e) {
        console.warn("Router contract call failed, deploying local fallback strategy:", e);
        // Fallback: compute locally from reserves if router call fails
        const out = getQuote(amountInWei, tokenIn.address);
        if (!cancelled) { 
            setAmountOutWei(out); 
            setBestPath([tokenIn.address, tokenOut.address]); 
            setRouteLabel("Direct"); }
      }
    }; fetchRoute();
    return () => { cancelled = true; };
  }, [amountInWei, tokenIn?.address, tokenOut?.address, getQuote]);

  const priceImpact = useMemo(
    () => getPriceImpactPct(amountInWei, tokenIn.address),
    [getPriceImpactPct, amountInWei, tokenIn.address]
  );
  const impact = fmtImpact(priceImpact);

  const minOut = useMemo(() => {
    const slipBps = BigInt(Math.floor((1 - parseFloat(slippage || "0.5") / 100) * 10000));
    return amountOutWei > 0n ? (amountOutWei * slipBps) / 10000n : 0n;
  }, [amountOutWei, slippage]);

  const rate = amountInWei > 0n && amountOutWei > 0n
    ? fmt(amountOutWei * 10n ** 18n / amountInWei, 4)
    : "—";

  function flip() {
    const prev = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(prev);
    setAmountIn("");
  }

  function handleTokenInChange(e) {
    const t = TOKENS.find(x => x.address === e.target.value);
    if (!t) return;
    if (t.address === tokenOut.address) setTokenOut(tokenIn);
    setTokenIn(t);
    setAmountIn("");
  }
  function handleTokenOutChange(e) {
    const t = TOKENS.find(x => x.address === e.target.value);
    if (!t) return;
    if (t.address === tokenIn.address) setTokenIn(tokenOut);
    setTokenOut(t);
  }

  // Build EIP-712 permit signature
  async function signPermit(tokenAddress, spender, amount, deadline) {
    const token  = new ethers.Contract(tokenAddress, PERMIT_ABI, signer);
    const [nonce, tokenName, domainSep] = await Promise.all([
      token.nonces(account), token.name(), token.DOMAIN_SEPARATOR(),
    ]);
    const domain = { name: tokenName, version: "1", chainId: 11155111, verifyingContract: tokenAddress };
    const types  = { Permit: [
      { name: "owner",    type: "address" },
      { name: "spender",  type: "address" },
      { name: "value",    type: "uint256" },
      { name: "nonce",    type: "uint256" },
      { name: "deadline", type: "uint256" },
    ]};
    const value  = { owner: account, spender, value: amount, nonce, deadline };
    const sig    = await signer.signTypedData(domain, types, value);
    return ethers.Signature.from(sig);
  }

  async function handleSwap() {
    if (!signer) return setStatus({ type: "error", msg: "Connect your wallet first." });
    if (bestPath.length < 2) return;
    setSwapping(true); setStatus(null);
    try {
      const router   = new ethers.Contract(ADDRESSES.router, ROUTER_ABI, signer);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

      if (usePermit) {
        setStatus({ type: "info", msg: "Sign permit in MetaMask (no gas for this step)…" });
        const sig = await signPermit(tokenIn.address, ADDRESSES.router, amountInWei, deadline);
        setStatus({ type: "info", msg: "Executing swap with permit…" });
        await (await router.swapWithPermit(
          amountInWei, minOut, bestPath, account, deadline, sig.v, sig.r, sig.s
        )).wait();
      } else {
        const token = new ethers.Contract(tokenIn.address, TOKEN_ABI, signer);
        setStatus({ type: "info", msg: "Approving token…" });
        await (await token.approve(ADDRESSES.router, amountInWei)).wait();
        setStatus({ type: "info", msg: routeLabel === "Direct" ? "Swapping…" : `Routing ${routeLabel}…` });
        await (await router.swapExactTokensForTokens(
          amountInWei, minOut, bestPath, account, deadline
        )).wait();
      }

      setStatus({ type: "success", msg: `✓ Swapped ${amountIn} ${tokenIn.label} → ${fmt(amountOutWei)} ${tokenOut.label}${bestPath.length > 2 ? ` (${routeLabel})` : ""}` });
      setAmountIn(""); setAmountOutWei(0n); setBestPath([]); setRouteLabel("");
      refresh();
    } catch (e) {
      setStatus({ type: "error", msg: e.reason || e.message || "Transaction failed." });
    }
    setSwapping(false);
  }

  const isToken0In   = token0Addr && tokenIn.address.toLowerCase() === token0Addr.toLowerCase();
  const reserveIn    = isToken0In ? reserves.r0 : reserves.r1;
  const reserveOut   = isToken0In ? reserves.r1 : reserves.r0;

  return (
    <div className="text-gray-100 min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#1a102f_0%,#09050f_60%,#030205_100%)] font-sans antialiased">
      <Nav account={account} onConnect={connect} />

      {/* Hero Header Section */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-8 text-center space-y-4">
        <div className="inline-flex items-center bg-pink-500/10 border border-pink-500/20 rounded-full px-4 py-1.5 text-xs text-pink-300 font-medium tracking-wide uppercase">
          x · y = k — transparently
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
          Swap on the <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-400">Curve</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Select any pair. The routing engine scans protocol depth to find optimal execution lanes direct or multi-hop automatically.
        </p>
      </div>

      {/* Main Structural App Layout Split */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Visual Graph Assets and Readouts */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#0e0a1a]/60 border border-purple-950/40 rounded-3xl p-6 backdrop-blur-md shadow-lg">
            <CurveStage
              reserveIn={Number(fmt(reserveIn, 2))}
              reserveOut={Number(fmt(reserveOut, 2))}
              amountIn={Number(amountIn) || 0}
              amountOut={Number(fmt(amountOutWei, 4))}
              tokenInLabel={tokenIn.label}
              tokenOutLabel={tokenOut.label}
            />
            
            <div className="grid grid-cols-3 gap-4 mt-6 border-t border-white/[0.04] pt-6 text-center sm:text-left">
              <div>
                <div className="text-xs text-gray-500 font-medium">{tokenIn.label} Reserve</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{fmt(reserveIn, 2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">{tokenOut.label} Reserve</div>
                <div className="text-lg font-bold text-rose-400 mt-0.5">{fmt(reserveOut, 2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Price Impact</div>
                <div className={`text-lg font-bold mt-0.5 ${impact.cls}`}>{impact.text}</div>
              </div>
            </div>
          </div>

          {/* TWAP Price Oracle Card Component */}
          {twapPrice && twapPrice > 0n && (
            <div className="bg-[#0e0a1a]/40 border border-purple-950/40 rounded-2xl p-4 flex justify-between items-center text-sm">
              <div className="flex items-center space-x-3">
                <span className="text-xl">📊</span>
                <div>
                  <div className="text-xs text-gray-500 font-medium">TWAP Price (30 min avg)</div>
                  <div className="text-white font-semibold mt-0.5">1 {TOKENS[0].label} = {fmt(twapPrice, 4)} {TOKENS[1].label}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-right leading-tight hidden sm:block">
                Manipulation‑resistant<br />oracle feed
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Functional Interactive Swap Card Component */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-[#130d22]/90 border border-purple-900/40 p-6 rounded-3xl backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            
            {/* Pay Input Box */}
            <div className="bg-[#1c1430] p-4 rounded-2xl border border-white/5 focus-within:border-purple-500/50 transition">
              <div className="text-xs text-gray-400 mb-2">You pay</div>
              <div className="flex justify-between items-center gap-4">
                <input
                  className="bg-transparent text-2xl font-bold w-2/3 outline-none focus:text-white text-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  type="number"
                  placeholder="0.0"
                  value={amountIn}
                  onChange={(e) => setAmountIn(e.target.value)}
                />
                <div className="relative shrink-0">
                  <select
                    className="bg-purple-950 hover:bg-purple-900 border border-purple-800 text-white font-semibold px-4 py-2 pr-8 rounded-xl text-sm appearance-none cursor-pointer transition"
                    value={tokenIn.address}
                    onChange={handleTokenInChange}
                  >
                    {TOKENS.filter(t => t.address !== tokenOut.address).map(t => (
                      <option key={t.address} value={t.address} className="bg-[#1c1430]">{t.label}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">▼</span>
                </div>
              </div>
            </div>

            {/* Middle Switch Wrapper */}
            <div className="flex justify-center -my-2.5 relative z-10">
              <button 
                onClick={flip}
                className="bg-[#1c1430] border-4 border-[#130d22] hover:border-purple-800 text-pink-500 w-9 h-9 flex items-center justify-center rounded-xl font-bold shadow-md transition-all active:scale-95"
              >
                ⇅
              </button>
            </div>

            {/* Receive Output Box */}
            <div className="bg-[#1c1430] p-4 rounded-2xl border border-white/5 focus-within:border-purple-500/50 transition">
              <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
                <span>You receive</span>
                {routeLabel && (
                  <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    {routeLabel}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center gap-4">
                <div className="text-2xl font-bold w-2/3 text-gray-300 overflow-x-auto whitespace-nowrap py-0.5">
                  {amountOutWei > 0n ? fmt(amountOutWei) : "0.0"}
                </div>
                <div className="relative shrink-0">
                  <select
                    className="bg-purple-950 hover:bg-purple-900 border border-purple-800 text-white font-semibold px-4 py-2 pr-8 rounded-xl text-sm appearance-none cursor-pointer transition"
                    value={tokenOut.address}
                    onChange={handleTokenOutChange}
                  >
                    {TOKENS.filter(t => t.address !== tokenIn.address).map(t => (
                      <option key={t.address} value={t.address} className="bg-[#1c1430]">{t.label}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">▼</span>
                </div>
              </div>
            </div>

            {/* Live Swap Dynamic Details Sheet */}
            {amountOutWei > 0n && (
              <div className="mt-4 bg-[#1c1430]/40 rounded-2xl p-4 border border-white/[0.02] space-y-2.5 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Rate</span>
                  <span className="text-white font-medium">1 {tokenIn.label} = {rate} {tokenOut.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Route Execution</span>
                  <span className="text-white font-medium">
                    {bestPath.length > 0
                      ? TOKENS.filter(t => bestPath.map(p => p.toLowerCase()).includes(t.address.toLowerCase())).map(t => t.label).join(" → ")
                      : "—"
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Price Impact</span>
                  <span className={impact.cls}>{impact.text}</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum Received</span>
                  <span className="text-white font-medium">{fmt(minOut)} {tokenOut.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Liquidity Provider Fee</span>
                  <span className="text-purple-300">{bestPath.length > 2 ? "0.3% × 2 hops" : "0.3%"}</span>
                </div>
              </div>
            )}

            {/* Slippage Settings Segment */}
            <div className="mt-4 flex items-center justify-between bg-[#1c1430]/30 px-3 py-2 rounded-xl border border-white/[0.01]">
              <span className="text-xs text-gray-400 font-medium">Slippage Tolerance</span>
              <div className="flex space-x-1.5">
                {["0.1", "0.5", "1.0"].map((s) => (
                  <button 
                    key={s} 
                    onClick={() => setSlippage(s)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                      slippage === s 
                        ? "bg-pink-500 text-white shadow-md" 
                        : "bg-purple-950/60 text-purple-300 hover:bg-purple-900/50"
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>

            {/* EIP-2612 Gasless Permit Verification Toggle Row */}
            <div className="mt-3 flex items-center justify-between bg-[#1c1430]/30 px-3 py-2 rounded-xl border border-white/[0.01]">
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-400 font-medium">Use Permit</span>
                <span className="bg-purple-500/10 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded text-purple-300 font-mono">EIP-2612</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-[10px] text-gray-500">
                  {usePermit ? "1 tx (sign + swap)" : "2 tx (approve + swap)"}
                </span>
                <div 
                  onClick={() => setUsePermit(p => !p)}
                  className={`w-9 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${usePermit ? 'bg-emerald-500' : 'bg-purple-950'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${usePermit ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            {/* Execution CTA Buttons Block */}
            <div className="mt-5">
              {!account ? (
                <button 
                  onClick={connect}
                  className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-2xl text-sm transition transform active:scale-[0.99] shadow-md"
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  disabled={swapping || amountInWei <= 0n || amountOutWei <= 0n}
                  onClick={handleSwap}
                  className={`w-full font-bold py-4 rounded-2xl text-sm transition transform active:scale-[0.99] flex justify-center items-center ${
                    swapping || amountInWei <= 0n || amountOutWei <= 0n
                      ? "bg-purple-950/40 border border-purple-900/30 text-purple-400/60 cursor-not-allowed"
                      : "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg"
                  }`}
                >
                  {swapping ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : amountInWei <= 0n ? (
                    "Enter an amount"
                  ) : (
                    `Swap${usePermit ? " with Permit" : ""}`
                  )}
                </button>
              )}
            </div>

            {/* Transaction Operational Logging Status Banner */}
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
        </div>
      </div>

      {/* AMM Constant Product Invariant Math Callout Footer */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="bg-[#0e0a1a]/40 border border-purple-950/30 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-gray-400">
          <span className="text-2xl shrink-0">📐</span>
          <div>
            <code className="text-white font-bold block mb-1">
              amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)
            </code>
            For multi-hop execution lanes, this equation evaluates recursively per node. The execution router switches seamlessly to provide the absolute highest token density output.
          </div>
        </div>
      </div>
    </div>
  );
}