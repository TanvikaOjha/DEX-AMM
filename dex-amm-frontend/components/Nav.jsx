"use client";
 
import Link from "next/link";
import { usePathname } from "next/navigation";
 
function truncate(str, n = 5) {
  if (!str) return "";
  return `${str.slice(0, n)}…${str.slice(-4)}`;
}
 
export default function Nav({ account, onConnect }) {
  const pathname = usePathname();
 
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand">
        <span className="nav-glyph">∞</span>
        AMM<span style={{ color: "var(--mint)" }}>//</span>
      </Link>
      <div className="nav-tabs">
        <Link href="/"      className={`nav-tab ${pathname === "/" ? "active" : ""}`}>Swap</Link>
        <Link href="/pool"  className={`nav-tab ${pathname === "/pool" ? "active" : ""}`}>Liquidity</Link>
        <Link href="/pools" className={`nav-tab ${pathname === "/pools" ? "active" : ""}`}>Markets</Link>
      </div>
      <div className={`wallet-pill ${account ? "connected" : ""}`} onClick={onConnect}>
        <div className="wallet-dot" />
        {account ? truncate(account) : "Connect"}
      </div>
    </nav>
  );
}
 