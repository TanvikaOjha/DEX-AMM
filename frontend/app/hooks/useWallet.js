"use client";

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";

export function useWallet() {
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState(null);

  const syncSigner = useCallback(async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const s = await provider.getSigner();
    setSigner(s);
    setAccount(await s.getAddress());
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("MetaMask not found - please install it.");
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      await syncSigner();
    } catch (e) {
      console.error("Wallet connect failed:", e);
    }
  }, [syncSigner]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    // Reconnect silently if already authorized
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accts) => {
        if (accts.length > 0) return syncSigner();
      })
      .catch((e) => console.error(e));

    const handleAccountsChanged = (accts) => {
      if (accts.length > 0) {
        syncSigner().catch((e) => console.error(e));
      } else {
        setAccount("");
        setSigner(null);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [syncSigner]);

  return { account, signer, connect };
}