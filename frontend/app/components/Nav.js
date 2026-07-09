// components/Nav.js
"use client";
import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";

import Link from "next/link";
import { usePathname } from "next/navigation";

function truncate(str, n = 5) {
  if (!str) return "";
  return `${str.slice(0, n)}…${str.slice(-4)}`;
}

export default function Nav({ account}) {
 const [account, setAccount] = useState(null);
  const pathname = usePathname();

  const handleConnectWallet = useCallback(async () => {
      if (!window.ethereum) return alert("MetaMask not found — please install it.");
     try{
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    if(accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (error) {
        console.error("Error connecting wallet:", error);
      }
      
    }, []);
  
    useEffect(() => {
      if(!window.ethereum) return;
  
      window.ethereum.request({method: 'eth_accounts'})
      .then((accounts)=> {
        if(accounts.length > 0) {
          setAccount(accounts[0]);
        }
      })
      .catch((err) => console.error(err));
  
      const handleAccountsChanged = (accounts) => { 
  
        if(accounts.length > 0) {
          setAccount(accounts[0]);
        }
        else {
          setAccount(null);
        }
      };
  
      window.ethereum.on('accountsChanged', handleAccountsChanged);
  
      return () => {
        if(window.ethereum.removeListener){
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }, []);

  return (
    <nav className="w-full max-w-7xl mx-auto px-6 py-4 flex justify-between items-center backdrop-blur-md sticky top-0 z-50 border-b border-white/[0.02]">
      {/* Brand Identity logo */}
      <Link href="/" className="flex items-center space-x-2 text-xl font-bold tracking-tight text-white group">
        <span className="text-pink-500 font-normal transition-transform duration-300 group-hover:rotate-12">∞</span>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight">
          NexusSwap
        </span>
      </Link>

      {/* Navigation Links / Tabs */}
      <div className="flex bg-[#1c1430]/40 p-1 rounded-xl border border-white/[0.03]">
        <Link 
          href="/swap" 
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
            pathname === "/swap" 
              ? "bg-purple-950 text-pink-400 shadow-sm border border-purple-900/40" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          Swap
        </Link>
        <Link 
          href="/pool" 
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
            pathname === "/pool" 
              ? "bg-purple-950 text-pink-400 shadow-sm border border-purple-900/40" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          Liquidity
        </Link>
        <Link 
          href="/pools" 
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
            pathname === "/pools" 
              ? "bg-purple-950 text-pink-400 shadow-sm border border-purple-900/40" 
              : "text-gray-400 hover:text-white"
          }`}
        >
          Markets
        </Link>
      </div>

      {/* Dynamic Wallet Pill Action Connection */}
      <button 
        onClick={handleConnectWallet}
        className={`flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-xl border transition-all duration-300 active:scale-[0.98] ${
          account 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" 
            : "bg-white text-black border-transparent hover:bg-gray-200 shadow-sm"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${account ? "bg-emerald-400 animate-pulse" : "bg-black/40"}`} />
        <span>{account ? truncate(account) : "Connect"}</span>
      </button>
    </nav>
  );
}