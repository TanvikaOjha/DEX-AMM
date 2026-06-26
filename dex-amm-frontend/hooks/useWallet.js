'use client'

import {useState, useCallback} from 'react';
import {ethers} from "ethers";

export function useWallet() {
    const [account, setAccount] = useState("");
    const [signer, setSigner] = useState(null);
   
    const connect = useCallback(async() => {
        if(!window.ethereum) {
            alert("Metamask not found - please install it.");
            return;
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const s = await provider.getSigner();
        setSigner(s);
        setAccount(await s.getAddress());
    }, []);
    return {account, signer, connect};
}