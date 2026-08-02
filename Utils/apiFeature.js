import { ethers } from "ethers";
import Web3Modal from "web3modal";

// INTERNAL IMPORT
import { ChatAppAddress, ChatAppABI } from "../Context/constants";

// POLYGON AMOY NETWORK CONFIG
const POLYGON_AMOY_CHAIN_ID = "0x13882"; // 80002
const POLYGON_AMOY_CONFIG = {
  chainId: POLYGON_AMOY_CHAIN_ID,
  chainName: "Polygon Amoy Testnet",
  nativeCurrency: {
    name: "POL",
    symbol: "POL",
    decimals: 18,
  },
  rpcUrls: ["https://polygon-amoy-bor-rpc.publicnode.com"],
  blockExplorerUrls: ["https://amoy.polygonscan.com"],
};

// AUTO-SWITCH KE POLYGON AMOY (jika belum di jaringan yang benar)
export const ensurePolygonAmoy = async () => {
  if (typeof window === "undefined" || !window.ethereum) return;

  const isLocalhost =
    ChatAppAddress.toLowerCase() ===
    "0x5fbdb2315678afecb367f032d93F642f64180aa3";
  if (isLocalhost) return; // Skip untuk localhost/hardhat

  const currentChainId = await window.ethereum.request({
    method: "eth_chainId",
  });
  if (currentChainId === POLYGON_AMOY_CHAIN_ID) return; // Sudah di Polygon Amoy

  try {
    // Coba switch ke Polygon Amoy
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_AMOY_CHAIN_ID }],
    });
  } catch (switchError) {
    // Jika jaringan belum ditambahkan di MetaMask (error 4902), tambahkan otomatis
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [POLYGON_AMOY_CONFIG],
      });
    } else {
      throw switchError;
    }
  }
};

// CHECK IF WALLET IS CONNECTED
export const CheckIfWalletConnected = async () => {
  try {
    if (!window.ethereum) return console.log("Install MetaMask");

    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    const firstAccount = accounts[0];
    return firstAccount;
  } catch (error) {
    console.log("Error while connecting to wallet", error);
  }
};

// CONNECT WALLET FUNCTION
export const connectWallet = async () => {
  try {
    if (!window.ethereum) return console.log("Install MetaMask");

    // Pastikan di jaringan Polygon Amoy sebelum connect
    await ensurePolygonAmoy();

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const firstAccount = accounts[0];
    return firstAccount;
  } catch (error) {
    console.log("Error while connecting to wallet", error);
  }
};

// FETCH CONTRACT FUNCTION
const fetchContract = (signerOrProvider) =>
  new ethers.Contract(ChatAppAddress, ChatAppABI, signerOrProvider);

// CONNECTING WITH SMART CONTRACT (menggunakan window.ethereum langsung, bukan Web3Modal)
export const connectingWithSmartContract = async () => {
  try {
    if (!window.ethereum) throw new Error("MetaMask tidak ditemukan");

    // Pastikan di jaringan Polygon Amoy sebelum transaksi
    await ensurePolygonAmoy();

    const provider = new ethers.providers.Web3Provider(window.ethereum);

    // Override gas fee untuk Polygon Amoy (minimum 25 Gwei, kita set 30 Gwei)
    const originalGetFeeData = provider.getFeeData.bind(provider);
    provider.getFeeData = async () => {
      const feeData = await originalGetFeeData();
      const minTip = ethers.utils.parseUnits("30", "gwei");
      return {
        gasPrice: feeData.gasPrice,
        maxPriorityFeePerGas:
          feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas.lt(minTip)
            ? minTip
            : feeData.maxPriorityFeePerGas || minTip,
        maxFeePerGas:
          feeData.maxFeePerGas && feeData.maxFeePerGas.lt(minTip)
            ? minTip.mul(2)
            : feeData.maxFeePerGas || minTip.mul(2),
      };
    };

    const signer = provider.getSigner();
    const contract = fetchContract(signer);

    return contract;
  } catch (error) {
    console.log("Error while connecting with smart contract", error);
  }
};

// CONVERT TIME
export const convertTime = (time) => {
  const newTime = new Date(time.toNumber() * 1000);

  const realTime =
    newTime.getHours() +
    ":" +
    newTime.getMinutes() +
    ":" +
    newTime.getSeconds() +
    "  Date:" +
    newTime.getDate() +
    "/" +
    (newTime.getMonth() + 1) +
    "/" +
    newTime.getFullYear();

  return realTime;
};

// CONNECTING READ-ONLY (tidak butuh wallet, untuk baca data publik)
export const connectingWithSmartContractReadOnly = () => {
  try {
    const isLocalhost =
      ChatAppAddress.toLowerCase() ===
      "0x5fbdb2315678afecb367f032d93F642f64180aa3";

    // 1. Coba gunakan window.ethereum jika sudah terhubung ke chain yang sesuai
    if (typeof window !== "undefined" && window.ethereum) {
      const targetChainId = isLocalhost ? "0x7a69" : "0x13882"; // 31337 atau 80002 (Polygon Amoy)
      if (window.ethereum.chainId === targetChainId) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        return fetchContract(provider);
      }
    }

    // 2. Jika tidak ada window.ethereum atau chain id tidak cocok, gunakan RPC URL
    if (isLocalhost) {
      const provider = new ethers.providers.JsonRpcProvider(
        "http://127.0.0.1:8545"
      );
      return fetchContract(provider);
    }

    // Gunakan satu RPC provider yang stabil untuk menghindari rate limit (429)
    const amoyRpcUrl = "https://polygon-amoy-bor-rpc.publicnode.com";
    const provider = new ethers.providers.JsonRpcProvider(amoyRpcUrl);
    const contract = fetchContract(provider);
    return contract;
  } catch (error) {
    console.log("Error connecting read-only contract", error);
  }
};