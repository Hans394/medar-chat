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
    const rpcUrl = isLocalhost 
      ? "http://127.0.0.1:8545" 
      : "https://ethereum-sepolia-rpc.publicnode.com";

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const contract = fetchContract(provider);
    return contract;
  } catch (error) {
    console.log("Error connecting read-only contract", error);
  }
};