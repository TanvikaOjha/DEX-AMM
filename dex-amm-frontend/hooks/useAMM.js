"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ADDRESSES, PAIR_ABI, TOKEN_ABI, RPC_URL } from "../lib/contracts";

export function useAMM(account) {
  const [reserves, setReserves] = useState({ r0: 0n, r1: 0n });
  const [token0Addr, setToken0Addr] = useState("");
  const [lpBalance, setLpBalance] = useState(0n);
  const [lpTotalSupply, setLpTotalSupply] = useState(0n);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const pair = new ethers.Contract(ADDRESSES.pair, PAIR_ABI, provider);

      const [r0, r1, t0, lpAddr] = await Promise.all([
        pair.reserve0(),
        pair.reserve1(),
        pair.token0(),
        pair.lpToken(),
      ]);
      setReserves({ r0, r1 });
      setToken0Addr(t0);

      const lpToken = new ethers.Contract(lpAddr, TOKEN_ABI, provider);
      const supply = await provider.call({
        to: lpAddr,
        data: ethers.id("totalSupply()").slice(0, 10),
      }).catch(() => null);

      if (account) {
        const bal = await lpToken.balanceOf(account);
        setLpBalance(bal);
      } else {
        setLpBalance(0n);
      }

      // totalSupply via raw call (not in our minimal TOKEN_ABI) — fallback safe parse
      try {
        const totalSupplyAbi = ["function totalSupply() view returns (uint256)"];
        const lpFull = new ethers.Contract(lpAddr, totalSupplyAbi, provider);
        setLpTotalSupply(await lpFull.totalSupply());
      } catch {
        setLpTotalSupply(0n);
      }

      setLoaded(true);
    } catch (e) {
      console.error("useAMM refresh failed:", e);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 12000); // light polling for "live" feel
    return () => clearInterval(interval);
  }, [refresh]);

  // x*y=k with 0.3% fee — mirrors the Solidity formula exactly
  function getQuote(amountInWei, tokenInAddress) {
    if (!amountInWei || amountInWei <= 0n || !token0Addr) return 0n;
    const isZeroForOne = tokenInAddress.toLowerCase() === token0Addr.toLowerCase();
    const rIn = isZeroForOne ? reserves.r0 : reserves.r1;
    const rOut = isZeroForOne ? reserves.r1 : reserves.r0;
    if (rIn === 0n || rOut === 0n) return 0n;
    const amountInWithFee = amountInWei * 997n;
    const numerator = amountInWithFee * rOut;
    const denominator = rIn * 1000n + amountInWithFee;
    return numerator / denominator;
  }

  function getPriceImpactPct(amountInWei, tokenInAddress) {
    if (!amountInWei || amountInWei <= 0n || !token0Addr) return 0;
    const isZeroForOne = tokenInAddress.toLowerCase() === token0Addr.toLowerCase();
    const rIn = isZeroForOne ? reserves.r0 : reserves.r1;
    if (rIn === 0n) return 0;
    // Impact approximated as amountIn / (reserveIn + amountIn) * 100
    const num = Number(amountInWei) * 100;
    const den = Number(rIn) + Number(amountInWei);
    return den === 0 ? 0 : num / den;
  }

  return { reserves, token0Addr, lpBalance, lpTotalSupply, loaded, refresh, getQuote, getPriceImpactPct };
}