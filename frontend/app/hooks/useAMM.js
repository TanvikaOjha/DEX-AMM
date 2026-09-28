"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  ADDRESSES, PAIR_ABI, ORACLE_ABI, LP_ABI, RPC_URL,
} from "../lib/contract";

const ZERO = "0x0000000000000000000000000000000000000000";

export function useAMM(account) {
  const [reserves, setReserves] = useState({ r0: 0n, r1: 0n });
  const [token0Addr, setToken0Addr] = useState("");
  const [lpBalance, setLpBalance] = useState(0n);
  const [lpTotalSupply, setLpTotalSupply] = useState(0n);
  const [loaded, setLoaded] = useState(false);
  const [twapPrice, setTwapPrice] = useState(null);

  const getPairReserves = useCallback(async (pairAddr) => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
    const [r0, r1, t0] = await Promise.all([
      pair.reserve0(), pair.reserve1(), pair.token0(),
    ]);
    return { r0, r1, t0 };
  }, []);

  const refresh = useCallback(
    async (pairAddr = ADDRESSES.pairAB) => {
      try {
        if (!pairAddr || pairAddr === ZERO) {
          throw new Error("Provided pairAddr is null or empty");
        }
        if (!RPC_URL) {
          throw new Error("NEXT_PUBLIC_RPC_URL is not set");
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);

        const [r0, r1, t0, lpAddr] = await Promise.all([
          pair.reserve0(), pair.reserve1(), pair.token0(), pair.lpToken(),
        ]);
        setReserves({ r0, r1 });
        setToken0Addr(t0);

        const lpToken = new ethers.Contract(lpAddr, LP_ABI, provider);
        const [supply, bal] = await Promise.all([
          lpToken.totalSupply(),
          account ? lpToken.balanceOf(account) : Promise.resolve(0n),
        ]);
        setLpTotalSupply(supply);
        setLpBalance(bal);

        // TWAP price from oracle (non-critical — may not be seeded yet)
        if (pairAddr === ADDRESSES.pairAB && ADDRESSES.oracle && ADDRESSES.oracle !== ZERO) {
          try {
            const oracle = new ethers.Contract(ADDRESSES.oracle, ORACLE_ABI, provider);
            const out = await oracle.consult(ADDRESSES.tokenA, ethers.parseEther("1"));
            setTwapPrice(out);
          } catch {
            setTwapPrice(null);
          }
        } else {
          setTwapPrice(null);
        }

        setLoaded(true);
      } catch (e) {
        console.error("useAMM refresh:", e.message);
      }
    },
    [account]
  );

  useEffect(() => {
    refresh();
    const id = setInterval(() => refresh(), 12000);
    return () => clearInterval(id);
  }, [refresh]);

  // x*y=k with 0.3% fee — mirrors the Solidity formula.
  // Memoized so it can safely be used in useEffect dependency arrays.
  const getQuote = useCallback(
    (amountInWei, tokenInAddress) => {
      if (!amountInWei || amountInWei <= 0n || !token0Addr) return 0n;
      const isZeroForOne = tokenInAddress.toLowerCase() === token0Addr.toLowerCase();
      const rIn = isZeroForOne ? reserves.r0 : reserves.r1;
      const rOut = isZeroForOne ? reserves.r1 : reserves.r0;
      if (rIn === 0n || rOut === 0n) return 0n;
      const amountInWithFee = amountInWei * 997n;
      return (amountInWithFee * rOut) / (rIn * 1000n + amountInWithFee);
    },
    [reserves, token0Addr]
  );

  const getPriceImpactPct = useCallback(
    (amountInWei, tokenInAddress) => {
      if (!amountInWei || amountInWei <= 0n || !token0Addr) return 0;
      const isZeroForOne = tokenInAddress.toLowerCase() === token0Addr.toLowerCase();
      const rIn = isZeroForOne ? reserves.r0 : reserves.r1;
      if (rIn === 0n) return 0;
      // Approximation: amountIn / (reserveIn + amountIn) * 100
      return (Number(amountInWei) * 100) / (Number(rIn) + Number(amountInWei));
    },
    [reserves, token0Addr]
  );

  return {
    reserves, token0Addr, lpBalance, lpTotalSupply, twapPrice, loaded,
    refresh, getPairReserves, getQuote, getPriceImpactPct,
  };
}