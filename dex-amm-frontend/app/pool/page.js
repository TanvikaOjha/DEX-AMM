"use client";

import { useState, useMemo } from "react";
import { ethers } from "ethers";
import Nav from "../../components/Nav";
import { useWallet } from "../../hooks/useWallet";
import { useAMM } from "../../hooks/useAMM";
import { ADDRESSES, TOKEN_LABELS, PAIR_ABI, TOKEN_ABI } from "../../lib/contract";

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
    <>
      <Nav account={account} onConnect={connect} />

      <div className="hero-strip">
        <div className="hero-eyebrow">Liquidity provisioning</div>
        <h1 className="hero-title">Become the <span className="accent">Other Side</span></h1>
        <p className="hero-sub">Deposit both tokens at the pool ratio. Earn 0.3% of every trade routed through your share.</p>
      </div>

      <div className="shell">

        {/* Pool stats */}
        <div className="pool-strip">
          <div className="ps-block">
            <div className="ps-val" style={{ color: "var(--mint)" }}>{fmt(reserves.r0, 1)}</div>
            <div className="ps-label">{labelA} in Pool</div>
          </div>
          <div className="ps-block">
            <div className="ps-val" style={{ color: "var(--coral)" }}>{fmt(reserves.r1, 1)}</div>
            <div className="ps-label">{labelB} in Pool</div>
          </div>
          <div className="ps-block">
            <div className="ps-val">{poolSharePct.toFixed(2)}%</div>
            <div className="ps-label">Your Share</div>
          </div>
        </div>

        <div className="page-tabs">
          <button className={`page-tab ${mode === "add" ? "active" : ""}`} onClick={() => setMode("add")}>Add Liquidity</button>
          <button className={`page-tab ${mode === "remove" ? "active" : ""}`} onClick={() => setMode("remove")}>Remove Liquidity</button>
        </div>

        <div className="trade-card">

          {mode === "add" ? (
            <>
              <div className="trade-box">
                <div className="trade-box-label"><span>Deposit</span></div>
                <div className="trade-row">
                  <input
                    className="trade-amount-input"
                    type="number"
                    placeholder="0.0"
                    value={amtA}
                    onChange={(e) => handleAmtAChange(e.target.value)}
                  />
                  <div className="token-pill"><span className="token-dot a" />{labelA}</div>
                </div>
              </div>

              <div className="flip-wrap"><div style={{ width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--faint)", fontSize: "16px" }}>+</div></div>

              <div className="trade-box">
                <div className="trade-box-label"><span>Deposit</span><span>Auto-filled to match pool ratio</span></div>
                <div className="trade-row">
                  <input
                    className="trade-amount-input"
                    type="number"
                    placeholder="0.0"
                    value={amtB}
                    onChange={(e) => setAmtB(e.target.value)}
                  />
                  <div className="token-pill"><span className="token-dot b" />{labelB}</div>
                </div>
              </div>

              {!account ? (
                <button className="btn-secondary" onClick={connect} style={{ margin: "14px 14px 14px" }}>Connect Wallet</button>
              ) : (
                <button
                  className={`btn-primary ${busy ? "loading" : ""}`}
                  disabled={busy || !amtA || !amtB}
                  onClick={handleAdd}
                  style={{ margin: "14px 14px 14px", width: "calc(100% - 28px)" }}
                >
                  {busy ? "" : "Add Liquidity"}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="trade-box">
                <div className="trade-box-label">
                  <span>Your LP Balance</span>
                  <span>{fmt(lpBalance)} ALP</span>
                </div>
                <div style={{ padding: "8px 0 4px" }}>
                  <div className="trade-amount-readonly" style={{ fontSize: "32px", textAlign: "center" }}>
                    {removePct}%
                  </div>
                  <input
                    type="range" min="1" max="100" value={removePct}
                    className="range-input"
                    onChange={(e) => setRemovePct(+e.target.value)}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                    {[25, 50, 75, 100].map((p) => (
                      <button
                        key={p}
                        className={`slip-btn ${removePct === p ? "active" : ""}`}
                        onClick={() => setRemovePct(p)}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="trade-details">
                <div className="td-row">
                  <span className="td-label">You'll receive ~{labelA}</span>
                  <span className="td-val">{fmt((reserves.r0 * lpBalance * BigInt(removePct)) / ((lpTotalSupply || 1n) * 100n))}</span>
                </div>
                <div className="td-row">
                  <span className="td-label">You'll receive ~{labelB}</span>
                  <span className="td-val">{fmt((reserves.r1 * lpBalance * BigInt(removePct)) / ((lpTotalSupply || 1n) * 100n))}</span>
                </div>
              </div>

              {!account ? (
                <button className="btn-secondary" onClick={connect} style={{ margin: "14px 14px 14px" }}>Connect Wallet</button>
              ) : (
                <button
                  className={`btn-primary ${busy ? "loading" : ""}`}
                  disabled={busy || lpBalance === 0n}
                  onClick={handleRemove}
                  style={{ margin: "14px 14px 14px", width: "calc(100% - 28px)" }}
                >
                  {busy ? "" : lpBalance === 0n ? "No LP tokens to remove" : `Remove ${removePct}%`}
                </button>
              )}
            </>
          )}

          {status && (
            <div className={`status-banner ${status.type}`} style={{ marginBottom: "14px" }}>
              {status.msg}
            </div>
          )}
        </div>

        <div className="info-callout">
          <span className="info-callout-icon">🎫</span>
          <span>
            LP tokens represent your proportional claim on the pool. Burn them anytime to withdraw your share of both reserves — plus any fees accrued since you deposited.
          </span>
        </div>

      </div>
    </>
  );
}