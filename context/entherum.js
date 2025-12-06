import React, { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";

const BlockchainContext = createContext(null);

export function BlockchainProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(web3Provider);

    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setSigner(web3Provider.getSigner());
        setIsConnected(true);
      } else {
        setAccount(null);
        setSigner(null);
        setIsConnected(false);
      }
    });

    window.ethereum.on("chainChanged", () => window.location.reload());

    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setSigner(web3Provider.getSigner());
        setIsConnected(true);
      }
    }).catch(() => {});
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    setAccount(accounts[0]);
    setProvider(web3Provider);
    setSigner(web3Provider.getSigner());
    setIsConnected(true);
    return accounts[0];
  };

  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setIsConnected(false);
  };

  return (
    <BlockchainContext.Provider value={{ account, provider, signer, isConnected, connectWallet, disconnectWallet }}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain() {
  const context = useContext(BlockchainContext);
  if (!context) throw new Error("useBlockchain must be used within BlockchainProvider");
  return context;
}

export default BlockchainContext;
