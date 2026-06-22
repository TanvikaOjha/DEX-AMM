"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function truncate(str, n = 5) {
  if (!str) return "";
  return `${str.slice(0, n)}…${str.slice(-4)}`;
}

export default function Nav({ account, onConnect }) {
  const pathname = usePathname();
  const isSwap = pathname === "/";
  const isPool = pathname.startsWith("/pool");
  const isPools = pathname.startsWith("/pools");

  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        <span className="nav-glyph">∞</span>
        AMM<span style={{ color: "#7CFFB2" }}>//</span>
      </Link>
      <div className="nav-tabs">
        <Link href="/" className={`nav-tab ${isSwap ? "active" : ""}`}>Swap</Link>
        <Link href="/pool" className={`nav-tab ${isPool ? "active" : ""}`}>Liquidity</Link>
        <Link href="/pools" className={`nav-tab ${isPools ? "active" : ""}`}>Markets</Link>

      </div>
      <div className={`wallet-pill ${account ? "connected" : ""}`} onClick={onConnect}>
        <div className="wallet-dot" />
        {account ? truncate(account) : "Connect"}
      </div>
    </nav>
  );
}