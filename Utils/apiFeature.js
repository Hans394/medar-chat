import { ethers } from "ethers";
import Web3Modal from "web3modal";

// INTERNAL IMPORT
import { ChatAppAddress, ChatAppABI } from "../Context/constants";

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

// CONNECTING WITH SMART CONTRACT
export const connectingWithSmartContract = async () => {
  try {
    const web3modal = new Web3Modal();
    const connection = await web3modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
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
    const isLocalhost = ChatAppAddress.toLowerCase() === "0x5fbdb2315678afecb367f032d93F642f64180aa3";

    // 1. Coba gunakan window.ethereum jika sudah terhubung ke chain yang sesuai
    if (typeof window !== "undefined" && window.ethereum) {
      const targetChainId = isLocalhost ? "0x7a69" : "0xaa36a7"; // 31337 atau 11155111
      if (window.ethereum.chainId === targetChainId) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        return fetchContract(provider);
      }
    }

    // 2. Jika tidak ada window.ethereum atau chain id tidak cocok, gunakan RPC URL
    if (isLocalhost) {
      const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
      return fetchContract(provider);
    }

    // List Sepolia RPC URLs fallback (only those supporting CORS for browser origins)
    const sepoliaRpcs = [
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://sepolia.gateway.tenderly.co",
      "https://sepolia.drpc.org",
      "https://gateway.tenderly.co/public/sepolia"
    ];

    const providerConfigs = sepoliaRpcs.map((url, index) => ({
      provider: new ethers.providers.JsonRpcProvider(url),
      priority: index + 1,
      stallTimeout: 2000,
    }));

    const provider = new ethers.providers.FallbackProvider(providerConfigs);
    const contract = fetchContract(provider);
    return contract;
  } catch (error) {
    console.log("Error connecting read-only contract", error);
  }
};