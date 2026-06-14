import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";

// INTERNAL IMPORT
import {
  CheckIfWalletConnected,
  connectWallet,
  connectingWithSmartContract,
  connectingWithSmartContractReadOnly,
} from "../Utils/apiFeature";
import { useNotification } from "../hooks/useNotification";

export const ChatAppContext = React.createContext();

const parseIPFSMsgPreview = (msg) => {
  if (msg && msg.startsWith("__IPFS__:")) {
    const parts = msg.split(":");
    const fileName = parts[2] || "Berkas";
    const fileType = parts[3] || "";
    if (fileType.startsWith("image/")) {
      return `📷 Foto: ${fileName}`;
    }
    return `📎 Berkas: ${fileName}`;
  }
  return msg;
};

const parseError = (error) => {
  if (
    error?.code === 4001 ||
    error?.message?.includes("user rejected") ||
    error?.message?.includes("User denied")
  ) {
    return "Transaksi dibatalkan oleh pengguna (User denied transaction).";
  }
  if (error?.reason) {
    return `Error: ${error.reason}`;
  }
  if (error?.data?.message) {
    return `Error: ${error.data.message}`;
  }
  if (error?.message) {
    if (error.message.includes("reverted with reason string")) {
      const match = error.message.match(/reverted with reason string '([^']+)'/);
      if (match) return `Error: ${match[1]}`;
    }
    return error.message;
  }
  return "Terjadi kesalahan. Silakan coba lagi.";
};

export const ChatAppProvider = ({ children }) => {
  // STATE VARIABLES
  const [account, setAccount] = useState("");
  const [userName, setUserName] = useState("");
  const [friendLists, setFriendLists] = useState([]);
  const [friendMsg, setFriendMsg] = useState([]);
  const [userLists, setUserLists] = useState([]);
  const [error, setError] = useState("");
  const [userAvatar, setUserAvatar] = useState(null);
  const [isInitialising, setIsInitialising] = useState(true);

  // ACTIVE CHAT STATE
  const [activeChatAddress, setActiveChatAddress] = useState("");
  const activeChatAddressRef = useRef("");
  // Ref untuk fix stale closure — selalu menyimpan nilai account terkini
  const accountRef = useRef("");
  // Ref untuk menyimpan preferensi notifikasi (agar tidak kena stale closure)
  const notifSettingsRef = useRef({ newMessages: true, friendRequests: true });

  useEffect(() => {
    activeChatAddressRef.current = activeChatAddress;
  }, [activeChatAddress]);

  // Selalu sinkronkan accountRef dengan state account
  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  // E2EE STATE VARIABLES
  const [chatPrivateKey, setChatPrivateKey] = useState("");
  const [chatPublicKey, setChatPublicKey] = useState("");
  const [chatSigningKey, setChatSigningKey] = useState(null);
  const [activeFriendPubKey, setActiveFriendPubKey] = useState(null);

  // Refs untuk menghindari stale closure di dalam polling interval
  const chatSigningKeyRef = useRef(null);
  const chatPrivateKeyRef = useRef("");
  useEffect(() => { chatSigningKeyRef.current = chatSigningKey; }, [chatSigningKey]);
  useEffect(() => { chatPrivateKeyRef.current = chatPrivateKey; }, [chatPrivateKey]);

  // NOTIFICATION STATE VIA CUSTOM HOOK
  const {
    notifications,
    unreadCount,
    addNotification,
    markNotificationRead,
    clearNotifications,
    markFriendNotificationsRead,
  } = useNotification(
    account,
    activeChatAddress,
    friendLists,
    chatPrivateKey,
    async (friendAddr) => {
      await readMessage(friendAddr, true);
    }
  );
  const router = useRouter();

  // Get smart contract instance silently without popup (if wallet is connected)
  const getContractSilent = async () => {
    try {
      if (!window.ethereum) return null;
      const activeAcc = account || window.ethereum.selectedAddress;
      if (!activeAcc) return null;
      const { ethers } = await import("ethers");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const { ChatAppAddress, ChatAppABI } = await import("./constants");
      return new ethers.Contract(ChatAppAddress, ChatAppABI, signer);
    } catch (e) {
      console.log("Failed to get contract silently:", e);
      return null;
    }
  };

  // ─── DERIVE CHAT ENCRYPTION KEYS FROM SIGNATURE ──────────────────────────────
  const deriveChatKeys = async (signerAddress, forcePrompt = false) => {
    try {
      if (!window.ethereum || !signerAddress) return null;

      const cacheKey = `chat_privkey_${signerAddress.toLowerCase()}`;

      if (chatPrivateKey && chatPublicKey && !forcePrompt) {
        return { privateKey: chatPrivateKey, publicKey: chatPublicKey, signingKey: chatSigningKey };
      }

      if (typeof window !== "undefined") {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached && !forcePrompt) {
          const { ethers } = await import("ethers");
          const signingKey = new ethers.utils.SigningKey(cached);
          const publicKey = signingKey.compressedPublicKey;
          setChatPrivateKey(cached);
          setChatPublicKey(publicKey);
          setChatSigningKey(signingKey);
          return { privateKey: cached, publicKey, signingKey };
        }
      }

      const { ethers } = await import("ethers");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const message = "Sign this message to enable encrypted chat.\n\nThis does NOT cost any gas.";
      const signature = await signer.signMessage(message);
      const privateKey = ethers.utils.keccak256(signature);
      const signingKey = new ethers.utils.SigningKey(privateKey);
      const publicKey = signingKey.compressedPublicKey;

      setChatPrivateKey(privateKey);
      setChatPublicKey(publicKey);
      setChatSigningKey(signingKey);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(cacheKey, privateKey);

        // Cache public key in profile for local discovery
        const profileKey = `profile_${signerAddress.toLowerCase()}`;
        const savedProfile = localStorage.getItem(profileKey);
        let profileData = {};
        if (savedProfile) {
          try {
            profileData = JSON.parse(savedProfile);
          } catch (e) {
            console.log(e);
          }
        }
        profileData.chatPublicKey = publicKey;
        localStorage.setItem(profileKey, JSON.stringify(profileData));
        localStorage.setItem(`profile_${signerAddress}`, JSON.stringify(profileData));
      }

      return { privateKey, publicKey, signingKey };
    } catch (err) {
      console.error("Failed to derive chat keys:", err);
      setError("Gagal memuat enkripsi chat: Tanda tangan ditolak.");
      return null;
    }
  };

  // ─── RESOLVE USER PROFILE FROM IPFS CID ──────────────────────────────────────
  // Semua data profil sekarang disimpan di IPFS. CID disimpan di blockchain.
  const resolveUserProfile = async (profileCid) => {
    if (!profileCid) return { name: "", publicKey: "", avatarIndex: null };

    try {
      const { fetchJSONFromIPFS } = await import("../Utils/ipfs");
      const profile = await fetchJSONFromIPFS(profileCid);
      return {
        name: profile.name || "",
        publicKey: profile.publicKey || "",
        avatarIndex: profile.avatarIndex !== undefined ? profile.avatarIndex : null,
      };
    } catch (err) {
      console.error("Failed to fetch profile from IPFS:", err);
      return { name: "Error Loading Profile", publicKey: "", avatarIndex: null };
    }
  };

  // ─── FETCH SEMUA USER (tidak butuh wallet) ────────────────────────────────────
  const fetchAllUsers = async () => {
    try {
      const contract = connectingWithSmartContractReadOnly();
      const userList = await contract.getAllAppUser();
      const resolvedList = await Promise.all(
        userList.map(async (u) => {
          const resolved = await resolveUserProfile(u.profileCid);
          let displayName = resolved.name;

          // Fallback ke localStorage jika IPFS gagal
          if (!displayName || displayName === "Error Loading Profile") {
            if (typeof window !== "undefined") {
              const savedProfile =
                localStorage.getItem(`profile_${u.accountAddress.toLowerCase()}`) ||
                localStorage.getItem(`profile_${u.accountAddress}`);
              if (savedProfile) {
                try {
                  const parsed = JSON.parse(savedProfile);
                  if (parsed.displayName) displayName = parsed.displayName;
                } catch (e) { }
              }
            }
          }

          return {
            accountAddress: u.accountAddress,
            name: displayName || resolved.name,
            publicKey: resolved.publicKey,
            avatarIndex: resolved.avatarIndex,
          };
        })
      );
      setUserLists(resolvedList);
    } catch (error) {
      console.log("Error fetching user list:", error);
    }
  };

  // ─── FETCH DATA PRIBADI ───────────────────────────────────────────────────────
  const fetchData = async (accountParam) => {
    try {
      const connectAccount = accountParam || await CheckIfWalletConnected();
      if (!connectAccount) return;

      setAccount(connectAccount);

      const { ethers } = await import("ethers");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const { ChatAppAddress, ChatAppABI } = await import("./constants");
      const contract = new ethers.Contract(ChatAppAddress, ChatAppABI, signer);

      // GET USER PROFILE FROM IPFS VIA ON-CHAIN CID
      try {
        const profileCid = await contract.getUserProfileCid(connectAccount);
        console.log("profileCid dari contract:", profileCid);

        const profile = await resolveUserProfile(profileCid);

        if (profile.name && profile.name !== "Error Loading Profile") {
          setUserName(profile.name);
          setUserAvatar(profile.avatarIndex);

          // Sync localStorage
          const profileData = {
            displayName: profile.name,
            avatarIndex: profile.avatarIndex,
            chatPublicKey: profile.publicKey,
          };
          localStorage.setItem(`profile_${connectAccount.toLowerCase()}`, JSON.stringify(profileData));
          localStorage.setItem(`profile_${connectAccount}`, JSON.stringify(profileData));
        } else {
          // IPFS gagal — fallback ke localStorage
          const savedProfile = localStorage.getItem(`profile_${connectAccount.toLowerCase()}`) || localStorage.getItem(`profile_${connectAccount}`);
          if (savedProfile) {
            try {
              const parsed = JSON.parse(savedProfile);
              setUserName(parsed.displayName || "");
              setUserAvatar(parsed.avatarIndex !== undefined ? parsed.avatarIndex : null);
            } catch (e) {
              setUserName("");
              setUserAvatar(null);
            }
          } else {
            setUserName("");
            setUserAvatar(null);
          }
        }

        // Auto derive chat keys if already registered
        await deriveChatKeys(connectAccount);
      } catch (err) {
        console.log("getUserProfileCid error:", err.message);
        setUserName("");
        setUserAvatar(null);
      }

      // GET MY FRIEND ADDRESSES (on-chain)
      const friendAddresses = await contract.getMyFriendAddresses();

      // GET FRIEND LIST METADATA FROM IPFS
      let friendMetadata = {};
      try {
        const friendListCid = await contract.getFriendListCid();
        if (friendListCid) {
          const { fetchJSONFromIPFS } = await import("../Utils/ipfs");
          friendMetadata = await fetchJSONFromIPFS(friendListCid);
        }
      } catch (e) {
        console.log("Friend list CID not found or fetch failed:", e.message);
      }

      // Resolve each friend's current profile from IPFS
      const resolvedFriends = await Promise.all(
        friendAddresses.map(async (friendAddr) => {
          let displayName = "";
          let publicKey = "";
          let avatarIndex = null;

          // Coba ambil profil terkini dari blockchain/IPFS
          try {
            const friendProfileCid = await contract.getUserProfileCid(friendAddr);
            const friendProfile = await resolveUserProfile(friendProfileCid);
            displayName = friendProfile.name;
            publicKey = friendProfile.publicKey;
            avatarIndex = friendProfile.avatarIndex;
          } catch (e) {
            console.warn("Failed to fetch friend profile:", friendAddr, e);
          }

          // Fallback ke metadata IPFS
          if (!displayName || displayName === "Error Loading Profile") {
            const meta = friendMetadata[friendAddr.toLowerCase()];
            if (meta) {
              displayName = meta.name || "";
              publicKey = publicKey || meta.publicKey || "";
            }
          }

          // Fallback ke localStorage
          if (!displayName || displayName === "Error Loading Profile") {
            if (typeof window !== "undefined") {
              const savedProfile =
                localStorage.getItem(`profile_${friendAddr.toLowerCase()}`) ||
                localStorage.getItem(`profile_${friendAddr}`);
              if (savedProfile) {
                try {
                  const parsed = JSON.parse(savedProfile);
                  if (parsed.displayName) displayName = parsed.displayName;
                } catch (e) { }
              }
            }
          }

          return {
            pubkey: friendAddr,
            name: displayName || `${friendAddr.slice(0, 6)}...${friendAddr.slice(-4)}`,
            publicKey,
            avatarIndex,
          };
        })
      );
      setFriendLists(resolvedFriends);
    } catch (error) {
      console.log("Error fetching data:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await fetchAllUsers();
        await fetchData();
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsInitialising(false);
      }
    };
    init();

    // Simpan reference handler agar bisa di-remove secara spesifik
    const handleAccountsChanged = (accounts) => {
      if (accounts.length > 0) {
        // Reset E2EE keys
        setChatPrivateKey("");
        setChatPublicKey("");
        setChatSigningKey(null);
        setActiveFriendPubKey(null);
        setActiveChatAddress("");

        setUserName("");
        setUserAvatar(null);
        setFriendLists([]);
        setFriendMsg([]);
        fetchData(accounts[0]);
      } else {
        setAccount("");
        setUserName("");
        setUserAvatar(null);
        setFriendLists([]);
        setActiveChatAddress("");

        setChatPrivateKey("");
        setChatPublicKey("");
        setChatSigningKey(null);
        setActiveFriendPubKey(null);
      }
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  // AUTO-REFRESH: polling readMessage setiap 5 detik saat chat aktif terbuka
  useEffect(() => {
    if (!activeChatAddress || !account) return;

    let timeoutId;
    let cancelled = false;
    let isRunning = false;

    const pollActiveChat = async () => {
      if (cancelled || isRunning) return;
      isRunning = true;
      try {
        await readMessage(activeChatAddress, true);
      } catch (e) {
        // Silent fail
      } finally {
        isRunning = false;
        if (!cancelled) {
          timeoutId = setTimeout(pollActiveChat, 5000);
        }
      }
    };

    timeoutId = setTimeout(pollActiveChat, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeChatAddress, account]);

  // Counter untuk mencegah race condition
  const readMessageIdRef = useRef(0);

  // ─── READ MESSAGE (with IPFS fetch + decryption) ──────────────────────────────
  const readMessage = async (friendAddress, isBackground = false) => {
    const thisRequestId = ++readMessageIdRef.current;
    try {
      if (!isBackground) {
        setActiveChatAddress(friendAddress);
        markFriendNotificationsRead(friendAddress);
      }
      const contract = isBackground ? await getContractSilent() : (await getContractSilent() || await connectingWithSmartContract());
      if (!contract) return;
      const read = await contract.readMessage(friendAddress);

      // Resolve recipient public key for E2EE decryption
      let recipientPubKey = null;
      const friend = friendLists.find(f => f.pubkey.toLowerCase() === friendAddress.toLowerCase());
      if (friend && friend.publicKey) {
        recipientPubKey = friend.publicKey;
      }
      if (!recipientPubKey) {
        try {
          const friendProfileCid = await contract.getUserProfileCid(friendAddress);
          const friendProfile = await resolveUserProfile(friendProfileCid);
          recipientPubKey = friendProfile.publicKey;
        } catch (e) {
          console.log("Failed to fetch recipient public key:", e);
        }
      }

      // Fallback: Check localStorage profile
      if (!recipientPubKey && typeof window !== "undefined") {
        const savedProfile = localStorage.getItem(`profile_${friendAddress.toLowerCase()}`) || localStorage.getItem(`profile_${friendAddress}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.chatPublicKey) recipientPubKey = parsed.chatPublicKey;
          } catch (e) { }
        }
      }

      setActiveFriendPubKey(recipientPubKey);

      // Resolve our own signing key
      const currentAcc = account || await CheckIfWalletConnected();
      let mySigningKey = chatSigningKey;
      if (!mySigningKey && chatPrivateKey) {
        const { ethers } = await import("ethers");
        mySigningKey = new ethers.utils.SigningKey(chatPrivateKey);
      }
      if (currentAcc && !mySigningKey) {
        const keys = await deriveChatKeys(currentAcc);
        if (keys) mySigningKey = keys.signingKey;
      }

      const { ethers } = await import("ethers");
      let aesKey = null;
      if (recipientPubKey && mySigningKey) {
        try {
          const sharedSecret = mySigningKey.computeSharedSecret(recipientPubKey);
          aesKey = ethers.utils.keccak256(sharedSecret);
        } catch (e) {
          console.error("Failed to compute shared secret:", e);
        }
      }

      const { decryptMessage } = await import("../Utils/crypto");
      const { fetchFromIPFS } = await import("../Utils/ipfs");
      let decryptedMessages = [];

      for (let i = 0; i < read.length; i++) {
        const m = read[i];
        let rawContent = m.msgCid; // Ini sekarang CID, bukan teks langsung

        // Fetch konten pesan dari IPFS
        try {
          rawContent = await fetchFromIPFS(m.msgCid);
        } catch (err) {
          console.error("Failed to fetch message from IPFS:", err);
          rawContent = "⚠️ Gagal memuat pesan dari IPFS";
        }

        let decryptedText = rawContent;
        let isEncrypted = false;

        if (rawContent.startsWith("__E2EE__:")) {
          isEncrypted = true;
          if (aesKey) {
            try {
              const parts = rawContent.split(":");
              const ciphertext = parts[1];
              const iv = parts[2];
              decryptedText = await decryptMessage(ciphertext, iv, aesKey);
            } catch (decErr) {
              console.error("Decryption failed:", decErr);
              decryptedText = "🔒 Encrypted Message (Gagal mendekripsi)";
            }
          } else {
            decryptedText = "🔒 Encrypted (Kunci tidak tersedia, tandatangani untuk membuka)";
          }
        }

        decryptedMessages.push({
          sender: m.sender,
          timestamp: m.timestamp,
          msg: decryptedText,
          isEncrypted,
        });
      }

      // Filter out messages cleared locally
      if (typeof window !== "undefined") {
        const currentAcc = account || await CheckIfWalletConnected();
        if (currentAcc) {
          const clearedTime = localStorage.getItem(`cleared_${currentAcc.toLowerCase()}`) || localStorage.getItem(`cleared_${currentAcc}`);
          if (clearedTime) {
            const clearedTimestamp = parseInt(clearedTime);
            decryptedMessages = decryptedMessages.filter((msg) => {
              const msgTime = msg.timestamp.toNumber() * 1000;
              return msgTime > clearedTimestamp;
            });
          }
        }
      }

      // Race condition check
      if (thisRequestId !== readMessageIdRef.current) return;

      const currentActive = isBackground ? activeChatAddressRef.current : friendAddress;
      if (currentActive && friendAddress.toLowerCase() === currentActive.toLowerCase()) {
        setFriendMsg(decryptedMessages);
      }
    } catch (error) {
      if (!isBackground) {
        setError("Currently You Have No Message");
      }
    }
  };

  // ─── CREATE ACCOUNT ───────────────────────────────────────────────────────────
  const createAccount = async ({ name, avatarIndex = 0 }) => {
    try {
      if (!name) return setError("Name cannot be empty, please provide a name");

      const connectAccount = account || await CheckIfWalletConnected();
      if (!connectAccount) return setError("Wallet not connected");

      // Force prompt user signature to generate encryption keys
      const keys = await deriveChatKeys(connectAccount, true);
      if (!keys) {
        return false;
      }

      const contract = await connectingWithSmartContract();

      // Upload profile JSON ke IPFS
      const { uploadJSONToIPFS } = await import("../Utils/ipfs");
      const resolvedAvatarIndex = (!isNaN(Number(avatarIndex)) && avatarIndex !== "" && avatarIndex !== null && avatarIndex !== undefined)
        ? Number(avatarIndex)
        : avatarIndex;
      const profileObj = { name, publicKey: keys.publicKey, avatarIndex: resolvedAvatarIndex };
      const profileCid = await uploadJSONToIPFS(profileObj, "profile.json");

      // Simpan CID profil di blockchain
      const getCreatedUser = await contract.createAccount(profileCid);
      await getCreatedUser.wait();

      setUserName(name);
      setUserAvatar(resolvedAvatarIndex);

      // Notifikasi
      addNotification({
        type: "account_created",
        title: "Akun berhasil dibuat 🎉",
        text: `Selamat datang, ${name}! Akun kamu telah terdaftar di blockchain.`,
        forAccount: connectAccount,
      });

      // Update localStorage
      if (typeof window !== "undefined") {
        const profileData = {
          displayName: name,
          avatarIndex: resolvedAvatarIndex,
          chatPublicKey: keys.publicKey,
        };
        localStorage.setItem(`profile_${connectAccount.toLowerCase()}`, JSON.stringify(profileData));
        localStorage.setItem(`profile_${connectAccount}`, JSON.stringify(profileData));
      }

      await fetchAllUsers();
      await fetchData();

      return true;
    } catch (error) {
      setError(parseError(error));
      return false;
    }
  };

  // ─── ADD FRIENDS ──────────────────────────────────────────────────────────────
  const addFriends = async ({ name, userAddress }) => {
    try {
      if (!name || !userAddress) return setError("Please provide name and address");
      const contract = await connectingWithSmartContract();

      // Tambahkan relasi on-chain (hanya alamat)
      const addMeAsFriend = await contract.addFriend(userAddress);
      await addMeAsFriend.wait();

      // Update friend metadata IPFS untuk kedua user
      await updateFriendListOnIPFS(contract);

      await fetchData(account);
      await fetchAllUsers();

      // Notifikasi
      const shortAddr = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
      addNotification({
        type: "friend_added",
        title: "Teman berhasil ditambahkan 👤",
        text: `${name} (${shortAddr}) telah ditambahkan ke daftar teman kamu.`,
        address: userAddress,
        forAccount: account,
      });

      router.push("/chat");
    } catch (error) {
      setError(parseError(error));
    }
  };

  // ─── UPDATE FRIEND LIST ON IPFS ───────────────────────────────────────────────
  // Helper: buat metadata teman dan upload ke IPFS, update CID di blockchain
  const updateFriendListOnIPFS = async (contractInstance) => {
    try {
      const contract = contractInstance || await getContractSilent();
      if (!contract) return;

      const friendAddresses = await contract.getMyFriendAddresses();
      const metadata = {};

      for (const addr of friendAddresses) {
        try {
          const friendProfileCid = await contract.getUserProfileCid(addr);
          const friendProfile = await resolveUserProfile(friendProfileCid);
          metadata[addr.toLowerCase()] = {
            name: friendProfile.name,
            publicKey: friendProfile.publicKey,
            avatarIndex: friendProfile.avatarIndex,
          };
        } catch (e) {
          metadata[addr.toLowerCase()] = { name: `${addr.slice(0, 6)}...${addr.slice(-4)}`, publicKey: "", avatarIndex: null };
        }
      }

      const { uploadJSONToIPFS } = await import("../Utils/ipfs");
      const friendListCid = await uploadJSONToIPFS(metadata, "friendlist.json");
      const tx = await contract.updateFriendListCid(friendListCid);
      await tx.wait();
    } catch (err) {
      console.warn("Failed to update friend list on IPFS:", err.message);
    }
  };

  // ─── DELETE FRIEND ────────────────────────────────────────────────────────────
  const deleteFriend = async (friendAddress) => {
    try {
      if (!friendAddress) return setError("Please provide friend address");

      const contract = await connectingWithSmartContract();
      const tx = await contract.deleteFriend(friendAddress);
      await tx.wait();

      // Update friend metadata di IPFS
      await updateFriendListOnIPFS(contract);

      await fetchData(account);
      await fetchAllUsers();
      return true;
    } catch (error) {
      setError(parseError(error));
      return false;
    }
  };

  // ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
  const sendMessage = async ({ msg, address }) => {
    try {
      if (!msg || !address) return setError("Please type your message");

      // CEK APAKAH KITA MEMBLOKIR PENERIMA
      if (typeof window !== "undefined" && account) {
        const myBlockedList = localStorage.getItem(`blocked_users_${account.toLowerCase()}`);
        if (myBlockedList) {
          try {
            const parsed = JSON.parse(myBlockedList);
            if (parsed.includes(address.toLowerCase()) || parsed.includes(address)) {
              setError("Anda tidak dapat mengirim pesan ke pengguna yang telah Anda blokir.");
              return;
            }
          } catch (e) {
            console.warn("Failed to parse blocked list:", e);
          }
        }
      }

      const contract = await connectingWithSmartContract();
      let payload = msg;
      let recipientPubKey = null;

      // Find public key from friend list
      const friend = friendLists.find(f => f.pubkey.toLowerCase() === address.toLowerCase());
      if (friend && friend.publicKey) {
        recipientPubKey = friend.publicKey;
      }

      // Fallback: fetch from on-chain profile CID
      if (!recipientPubKey) {
        try {
          const friendProfileCid = await contract.getUserProfileCid(address);
          const friendProfile = await resolveUserProfile(friendProfileCid);
          recipientPubKey = friendProfile.publicKey;
        } catch (e) {
          console.log("Failed to fetch recipient public key:", e);
        }
      }

      // Fallback: localStorage
      if (!recipientPubKey && typeof window !== "undefined") {
        const savedProfile = localStorage.getItem(`profile_${address.toLowerCase()}`) || localStorage.getItem(`profile_${address}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.chatPublicKey) recipientPubKey = parsed.chatPublicKey;
          } catch (e) { }
        }
      }

      // Resolve our own signing key
      const currentAcc = account || await CheckIfWalletConnected();
      let mySigningKey = chatSigningKey;
      if (!mySigningKey && chatPrivateKey) {
        const { ethers } = await import("ethers");
        mySigningKey = new ethers.utils.SigningKey(chatPrivateKey);
      }
      if (currentAcc && !mySigningKey) {
        const keys = await deriveChatKeys(currentAcc);
        if (keys) mySigningKey = keys.signingKey;
      }

      // Encrypt the payload if possible
      if (recipientPubKey && mySigningKey) {
        try {
          const { ethers } = await import("ethers");
          const sharedSecret = mySigningKey.computeSharedSecret(recipientPubKey);
          const aesKey = ethers.utils.keccak256(sharedSecret);
          const { encryptMessage } = await import("../Utils/crypto");
          const encrypted = await encryptMessage(msg, aesKey);
          payload = `__E2EE__:${encrypted.ciphertext}:${encrypted.iv}`;
        } catch (encErr) {
          console.error("Encryption failed, sending as plaintext:", encErr);
        }
      }

      // Upload payload (encrypted or plaintext) ke IPFS → dapat CID
      const { uploadTextToIPFS } = await import("../Utils/ipfs");
      const msgCid = await uploadTextToIPFS(payload, "message.txt");

      // Simpan CID di blockchain (bukan teks pesan!)
      const addMessage = await contract.sendMessage(address, msgCid);

      await addMessage.wait();
      await readMessage(address);
    } catch (error) {
      setError(parseError(error));
    }
  };

  // ─── CONNECT WALLET ───────────────────────────────────────────────────────────
  const handleConnectWallet = async () => {
    try {
      const walletAddress = await connectWallet();
      if (!walletAddress) return { account: null, registered: false };

      setAccount(walletAddress);

      const contract = await connectingWithSmartContract();
      const registered = await contract.checkUserExist(walletAddress);

      if (registered) {
        await fetchData(walletAddress);
      }

      return { account: walletAddress, registered };
    } catch (error) {
      console.error("handleConnectWallet error:", error);
      setError("Gagal connect wallet, coba lagi");
      return { account: null, registered: false };
    }
  };

  // ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
  // Menyimpan ke localStorage DAN sinkronisasi ke IPFS/blockchain
  const updateProfile = async ({ displayName, avatarIndex }) => {
    if (!account) return;

    // Baca data lama
    let existingData = {};
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`profile_${account.toLowerCase()}`) || localStorage.getItem(`profile_${account}`);
      if (saved) {
        try { existingData = JSON.parse(saved); } catch (e) { }
      }
    }

    const newDisplayName = displayName || userName;
    const newAvatarIndex = avatarIndex !== undefined ? avatarIndex : userAvatar;

    const profileData = {
      ...existingData,
      displayName: newDisplayName,
      avatarIndex: newAvatarIndex,
    };

    // Simpan ke localStorage untuk immediate UI feedback
    localStorage.setItem(`profile_${account.toLowerCase()}`, JSON.stringify(profileData));
    localStorage.setItem(`profile_${account}`, JSON.stringify(profileData));

    if (displayName) setUserName(displayName);
    if (avatarIndex !== undefined) setUserAvatar(avatarIndex);

    // Sinkronisasi ke IPFS + blockchain
    const nameChanged = displayName && displayName !== userName;
    const avatarChanged = avatarIndex !== undefined && avatarIndex !== userAvatar;

    if (nameChanged || avatarChanged) {
      try {
        const contract = await getContractSilent();
        if (!contract) return;

        const keys = await deriveChatKeys(account);
        const publicKey = keys ? keys.publicKey : (existingData.chatPublicKey || chatPublicKey);

        // Upload profil baru ke IPFS
        const { uploadJSONToIPFS } = await import("../Utils/ipfs");
        const profileObj = {
          name: newDisplayName,
          publicKey,
          avatarIndex: newAvatarIndex,
        };
        const profileCid = await uploadJSONToIPFS(profileObj, "profile.json");

        // Update CID di smart contract
        const tx = await contract.updateProfileCid(profileCid);
        await tx.wait();

        // Refresh data
        await fetchAllUsers();
      } catch (err) {
        console.warn("Gagal update profil di blockchain:", err.message);
      }
    }
  };

  // ─── CLEAR CHAT HISTORY ───────────────────────────────────────────────────────
  const clearChatHistory = () => {
    if (typeof window !== "undefined") {
      const currentAcc = account || window.ethereum?.selectedAddress;
      if (currentAcc) {
        const now = Date.now();
        localStorage.setItem(`cleared_${currentAcc.toLowerCase()}`, now.toString());
        localStorage.setItem(`cleared_${currentAcc}`, now.toString());
      }
    }
  };

  // ─── DISCONNECT WALLET ────────────────────────────────────────────────────────
  const disconnectWallet = () => {
    setAccount("");
    setUserName("");
    setUserAvatar(null);
    setFriendLists([]);
    setFriendMsg([]);
    setActiveChatAddress("");

    setChatPrivateKey("");
    setChatPublicKey("");
    setChatSigningKey(null);
    setActiveFriendPubKey(null);

    router.push("/");
  };

  return (
    <ChatAppContext.Provider
      value={{
        readMessage,
        createAccount,
        addFriends,
        deleteFriend,
        sendMessage,
        connectWallet: handleConnectWallet,
        account,
        userName,
        userAvatar,
        updateProfile,
        clearChatHistory,
        disconnectWallet,
        friendLists,
        friendMsg,
        userLists,
        error,
        setError,
        chatPublicKey,
        activeFriendPubKey,
        deriveChatKeys,
        notifications,
        unreadCount,
        markNotificationRead,
        clearNotifications,
        markFriendNotificationsRead,
        notifSettingsRef,
        activeChatAddress,
        setActiveChatAddress,
        isInitialising
      }}
    >
      {children}
    </ChatAppContext.Provider>
  );
};