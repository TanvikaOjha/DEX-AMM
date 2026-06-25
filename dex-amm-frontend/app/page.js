"use client";

import { useState, useMemo } from "react";
import { ethers } from "ethers";
import Nav from "../components/Nav";
import CurveStage from "../components/CurveStage";
import { useWallet } from "../hooks/useWallet";
import { useAMM } from "../hooks/useAMM";
import { ADDRESSES, TOKEN_LABELS, ROUTER_ABI, TOKEN_ABI } from "../lib/contract";

function fmt(bigint, dec = 4) {
  try {
    return parseFloat(ethers.formatEther(bigint || 0n)).toFixed(dec);
  } catch {
    return "0.0000";
  }
}

export default function SwapPage() {
  const { account, signer, connect } = useWallet();
  const { reserves, token0Addr, getQuote, getPriceImpactPct, refresh } = useAMM(account);

  const tokens = [
    { label: TOKEN_LABELS[ADDRESSES.tokenA] || "TKA", address: ADDRESSES.tokenA },
    { label: TOKEN_LABELS[ADDRESSES.tokenB] || "TKB", address: ADDRESSES.tokenB },
  ];

  const [tokenIn, setTokenIn] = useState(tokens[0]);
  const [tokenOut, setTokenOut] = useState(tokens[1]);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [swapping, setSwapping] = useState(false);
  const [status, setStatus] = useState(null);

  const amountInWei = useMemo(() => {
    try { return amountIn ? ethers.parseEther(amountIn) : 0n; } catch { return 0n; }
  }, [amountIn]);

  const amountOutWei = useMemo(
    () => getQuote(amountInWei, tokenIn.address),
    [amountInWei, tokenIn, reserves, token0Addr]
  );

  const priceImpact = useMemo(
    () => getPriceImpactPct(amountInWei, tokenIn.address),
    [amountInWei, tokenIn, reserves, token0Addr]
  );

  const minOut = useMemo(() => {
    const slipBps = BigInt(Math.floor((1 - parseFloat(slippage || "0") / 100) * 10000));
    return (amountOutWei * slipBps) / 10000n;
  }, [amountOutWei, slippage]);

  const rate = amountInWei > 0n && amountOutWei > 0n
    ? (amountOutWei * 10n ** 18n) / amountInWei
    : 0n;

  const isToken0In = token0Addr && tokenIn.address.toLowerCase() === token0Addr.toLowerCase();
  const reserveIn = isToken0In ? reserves.r0 : reserves.r1;
  const reserveOut = isToken0In ? reserves.r1 : reserves.r0;

  function flip() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
  }

  async function handleSwap() {
    if (!signer) return setStatus({ type: "error", msg: "Connect your wallet first." });
    setSwapping(true);
    setStatus(null);
    try {
      const token = new ethers.Contract(tokenIn.address, TOKEN_ABI, signer);
      const router = new ethers.Contract(ADDRESSES.router, ROUTER_ABI, signer);

      setStatus({ type: "info", msg: "Approving token…" });
      const approveTx = await token.approve(ADDRESSES.router, amountInWei);
      await approveTx.wait();

      setStatus({ type: "info", msg: "Swapping…" });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      const swapTx = await router.swapExactTokensForTokens(
        tokenIn.address, tokenOut.address, amountInWei, minOut, account, deadline
      );
      await swapTx.wait();

      setStatus({ type: "success", msg: `✓ Swapped ${amountIn} ${tokenIn.label} → ${fmt(amountOutWei)} ${tokenOut.label}` });
      setAmountIn("");
      refresh();
    } catch (e) {
      setStatus({ type: "error", msg: e.reason || e.message || "Transaction failed." });
    }
    setSwapping(false);
  }

  return (
    <>
      <Nav account={account} onConnect={connect} />

      <div className="hero-strip">
        <div className="hero-eyebrow">x · y = k — transparently</div>
        <h1 className="hero-title">Swap on the <span className="accent">Curve</span></h1>
        <p className="hero-sub">Every trade moves along this exact hyperbola. The dot shows where your trade lands — and how the price bends as size grows.</p>
      </div>

      <div className="shell">


        <div className="curve-stage">
          <CurveStage
            reserveIn={Number(ethers.formatEther(reserveIn || 0n))}
            reserveOut={Number(ethers.formatEther(reserveOut || 0n))}
            amountIn={Number(amountIn) || 0}
            amountOut={Number(ethers.formatEther(amountOutWei || 0n))}
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
              <div className={`cr-val ${priceImpact > 2 ? "warn" : ""}`}>{priceImpact.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        <div className="trade-card">

          <div className="trade-box">
            <div className="trade-box-label">
              <span>You pay</span>
              <span>Balance: —</span>
            </div>
            <div className="trade-row">
              <input
                className="trade-amount-input"
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
              />
              <div className="token-pill">
                <span className="token-dot a" />
                {tokenIn.label}
              </div>
            </div>
          </div>

          <div className="flip-wrap">
            <div className="flip-btn" onClick={flip}>⇅</div>
          </div>

          <div className="trade-box">
            <div className="trade-box-label">
              <span>You receive</span>
              <span>Estimated</span>
            </div>
            <div className="trade-row">
              <div className="trade-amount-readonly">
                {amountOutWei > 0n ? fmt(amountOutWei) : "0.0"}
              </div>
              <div className="token-pill">
                <span className="token-dot b" />
                {tokenOut.label}
              </div>
            </div>
          </div>

          {amountOutWei > 0n && (
            <div className="trade-details">
              <div className="td-row">
                <span className="td-label">Rate</span>
                <span className="td-val">1 {tokenIn.label} = {fmt(rate)} {tokenOut.label}</span>
              </div>
              <div className="td-row">
                <span className="td-label">Price impact</span>
                <span className={`td-val ${priceImpact > 2 ? "warn" : ""}`}>{priceImpact.toFixed(2)}%</span>
              </div>
              <div className="td-row">
                <span className="td-label">Minimum received</span>
                <span className="td-val">{fmt(minOut)} {tokenOut.label}</span>
              </div>
              <div className="td-row">
                <span className="td-label">Liquidity provider fee</span>
                <span className="td-val">0.30%</span>
              </div>
            </div>
          )}

          <div className="slippage-row">
            <span style={{ fontFamily: "var(--display)", fontSize: "10px", color: "var(--muted)", alignSelf: "center", marginRight: "4px" }}>
              Slippage
            </span>
            {["0.1", "0.5", "1.0"].map((s) => (
              <button key={s} className={`slip-btn ${slippage === s ? "active" : ""}`} onClick={() => setSlippage(s)}>
                {s}%
              </button>
            ))}
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
              {swapping ? "" : amountInWei <= 0n ? "Enter an amount" : "Swap"}
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
            <strong style={{ color: "var(--text)" }}>amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)</strong>
            <br />The 997/1000 ratio encodes the 0.3% swap fee. This is the exact formula running on-chain — nothing hidden.
          </span>
        </div>

      </div>
    </>
  );
}