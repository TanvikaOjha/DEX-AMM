// app/page.js
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import CurveStage from "../components/CurveStage";
import { useWallet } from "../hooks/useWallet";
import { useAMM } from "../hooks/useAMM";
import {
  ADDRESSES, TOKENS, ROUTER_ABI, TOKEN_ABI, ORACLE_ABI, RPC_URL,
} from "../lib/contract";

// ── Helpers ──────────────────────────────────────────────────────
function fmt(bigint, dec = 4) {
  try { return parseFloat(ethers.formatEther(bigint || 0n)).toFixed(dec); } catch { return "0.0000"; }
}
function fmtImpact(pct) {
  if (pct < 0.01) return { text: "<0.01%", cls: "" };
  if (pct < 1)    return { text: `${pct.toFixed(2)}%`, cls: "" };
  if (pct < 3)    return { text: `${pct.toFixed(2)}%`, cls: "warn" };
  return { text: `${pct.toFixed(2)}%`, cls: "danger" };
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
    if (!amountInWei || amountInWei <= 0n || tokenIn.address === tokenOut.address) {
      setAmountOutWei(0n); setBestPath([]); setRouteLabel(""); return;
    }
    let cancelled = false;
    (async () => {
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
      } catch {
        // Fallback: compute locally from reserves if router call fails
        const out = getQuote(amountInWei, tokenIn.address);
        if (!cancelled) { setAmountOutWei(out); setBestPath([tokenIn.address, tokenOut.address]); setRouteLabel("Direct"); }
      }
    })();
    return () => { cancelled = true; };
  }, [amountInWei, tokenIn, tokenOut]);

  const priceImpact = useMemo(
    () => getPriceImpactPct(amountInWei, tokenIn.address),
    [amountInWei, tokenIn, reserves, token0Addr]
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
  const tokenInColor = tokenIn.colorClass;
  const tokenOutColor = tokenOut.colorClass;

  return (
    <>
      <Nav account={account} onConnect={connect} />

      <div className="hero-strip">
        <div className="hero-eyebrow">x · y = k — transparently</div>
        <h1 className="hero-title">Swap on the <span className="accent">Curve</span></h1>
        <p className="hero-sub">
          Select any pair. The router finds the best route — direct or multi-hop — automatically.
        </p>
      </div>

      <div className="shell">

        {/* Live AMM curve visualization */}
        <div className="curve-stage">
          <CurveStage
            reserveIn={Number(fmt(reserveIn, 2))}
            reserveOut={Number(fmt(reserveOut, 2))}
            amountIn={Number(amountIn) || 0}
            amountOut={Number(fmt(amountOutWei, 4))}
            tokenInLabel={tokenIn.label}
            tokenOutLabel={tokenOut.label}
          />
          <div className="curve-readout">
            <div className="cr-block">
              <div className="cr-label">{tokenIn.label} Reserve</div>
              <div className="cr-val mint">{fmt(reserveIn, 2)}</div>
            </div>
            <div className="cr-block">
              <div className="cr-label">{tokenOut.label} Reserve</div>
              <div className="cr-val coral">{fmt(reserveOut, 2)}</div>
            </div>
            <div className="cr-block">
              <div className="cr-label">Price Impact</div>
              <div className={`cr-val ${impact.cls}`}>{impact.text}</div>
            </div>
          </div>
        </div>

        {/* TWAP price card — only shown when oracle is deployed and seeded */}
        {twapPrice && twapPrice > 0n && (
          <div className="twap-card">
            <div className="twap-left">
              <span className="twap-icon">📊</span>
              <div>
                <div className="twap-label">TWAP Price (30 min avg)</div>
                <div className="twap-val">1 TKA = {fmt(twapPrice, 4)} TKB</div>
              </div>
            </div>
            <div className="twap-sub" style={{ textAlign: "right" }}>
              Manipulation‑resistant<br />oracle price
            </div>
          </div>
        )}

        {/* Trade card */}
        <div className="trade-card">

          {/* Pay box */}
          <div className="trade-box">
            <div className="trade-box-label">
              <span>You pay</span>
            </div>
            <div className="trade-row">
              <input
                className="trade-amount-input"
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
              />
              {/* Token selector dropdown */}
              <div className="token-select-wrap">
                <select
                  className="token-select"
                  value={tokenIn.address}
                  onChange={handleTokenInChange}
                >
                  {TOKENS.filter(t => t.address !== tokenOut.address).map(t => (
                    <option key={t.address} value={t.address}>{t.label}</option>
                  ))}
                </select>
                <span className="token-select-arrow">▾</span>
              </div>
            </div>
          </div>

          <div className="flip-wrap">
            <div className="flip-btn" onClick={flip}>⇅</div>
          </div>

          {/* Receive box */}
          <div className="trade-box">
            <div className="trade-box-label">
              <span>You receive</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {routeLabel && (
                  <span className="route-badge">
                    <span className="rb-dot" />
                    {routeLabel}
                  </span>
                )}
                <span>Estimated</span>
              </span>
            </div>
            <div className="trade-row">
              <div className="trade-amount-readonly">
                {amountOutWei > 0n ? fmt(amountOutWei) : "0.0"}
              </div>
              <div className="token-select-wrap">
                <select
                  className="token-select"
                  value={tokenOut.address}
                  onChange={handleTokenOutChange}
                >
                  {TOKENS.filter(t => t.address !== tokenIn.address).map(t => (
                    <option key={t.address} value={t.address}>{t.label}</option>
                  ))}
                </select>
                <span className="token-select-arrow">▾</span>
              </div>
            </div>
          </div>

          {/* Trade details */}
          {amountOutWei > 0n && (
            <div className="trade-details">
              <div className="td-row">
                <span className="td-label">Rate</span>
                <span className="td-val">1 {tokenIn.label} = {rate} {tokenOut.label}</span>
              </div>
              <div className="td-row">
                <span className="td-label">Route</span>
                <span className="td-val">
                  {bestPath.length > 0
                    ? TOKENS.filter(t => bestPath.map(p => p.toLowerCase()).includes(t.address.toLowerCase())).map(t => t.label).join(" → ")
                    : "—"
                  }
                </span>
              </div>
              <div className="td-row">
                <span className="td-label">Price impact</span>
                <span className={`td-val ${impact.cls}`}>{impact.text}</span>
              </div>
              <div className="td-row">
                <span className="td-label">Minimum received</span>
                <span className="td-val">{fmt(minOut)} {tokenOut.label}</span>
              </div>
              <div className="td-row">
                <span className="td-label">LP fee</span>
                <span className="td-val">{bestPath.length > 2 ? "0.3% × 2 hops" : "0.3%"}</span>
              </div>
            </div>
          )}

          {/* Slippage */}
          <div className="slippage-row">
            <span className="slip-label">Slippage</span>
            {["0.1", "0.5", "1.0"].map((s) => (
              <button key={s} className={`slip-btn ${slippage === s ? "active" : ""}`} onClick={() => setSlippage(s)}>
                {s}%
              </button>
            ))}
          </div>

          {/* Permit toggle */}
          <div className="permit-row">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Use Permit</span>
              <span className="permit-badge">EIP-2612</span>
            </div>
            <div className="permit-toggle-wrap">
              <span style={{ fontSize: "10px", color: usePermit ? "var(--teal)" : "var(--faint)" }}>
                {usePermit ? "1 tx (sign + swap)" : "2 tx (approve + swap)"}
              </span>
              <div className={`toggle ${usePermit ? "on" : ""}`} onClick={() => setUsePermit(p => !p)}>
                <div className="toggle-thumb" />
              </div>
            </div>
          </div>

          {!account ? (
            <button className="btn-secondary" onClick={connect} style={{ margin: "10px 14px 14px" }}>
              Connect Wallet
            </button>
          ) : (
            <button
              className={`btn-primary ${swapping ? "loading" : ""}`}
              disabled={swapping || amountInWei <= 0n || amountOutWei <= 0n}
              onClick={handleSwap}
              style={{ margin: "10px 14px 14px", width: "calc(100% - 28px)" }}
            >
              {swapping ? "" : amountInWei <= 0n ? "Enter an amount" : `Swap${usePermit ? " with Permit" : ""}`}
            </button>
          )}

          {status && (
            <div className={`status-banner ${status.type}`} style={{ marginBottom: "14px" }}>
              {status.msg}
            </div>
          )}
        </div>

        <div className="info-callout">
          <span className="info-callout-icon">📐</span>
          <span>
            <strong style={{ color: "var(--text)" }}>
              amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)
            </strong>
            <br />For multi-hop routes, this formula runs once per hop. The router picks direct or 2-hop — whichever gives you more tokens.
          </span>
        </div>

      </div>
    </>
  );
}