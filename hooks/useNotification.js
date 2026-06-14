import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { ChatAppAddress, ChatAppABI } from "../Context/constants";

const parseIPFSMsgPreview = (msg) => {
  if (msg && msg.startsWith("__IPFS__:")) {
    const parts = msg.split(":");
    const fileName = parts[2] || "Berkas";
    const fileType = parts[3] || "";
    if (fileType.startsWith("image/")) return `📷 Foto: ${fileName}`;
    return `📎 Berkas: ${fileName}`;
  }
  return msg;
};

const fetchFromIPFSWithTimeout = async (cid, timeoutMs = 3000) => {
  const { fetchFromIPFS } = await import("../Utils/ipfs");
  return Promise.race([
    fetchFromIPFS(cid),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("IPFS fetch timeout")), timeoutMs)
    ),
  ]);
};

// ─── localStorage helpers untuk seed counts ──────────────────────────────────
const loadSeedCounts = (account) => {
  if (typeof window === "undefined" || !account) return {};
  try {
    const raw = localStorage.getItem(`chat_msgcounts_${account.toLowerCase()}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveSeedCounts = (account, counts) => {
  if (typeof window === "undefined" || !account) return;
  try {
    localStorage.setItem(
      `chat_msgcounts_${account.toLowerCase()}`,
      JSON.stringify(counts)
    );
  } catch (e) { }
};

// ─────────────────────────────────────────────────────────────────────────────

export const useNotification = (
  account,
  activeChatAddress,
  friendLists,
  chatPrivateKey,
  onActiveChatNewMessage
) => {
  const [notifications, setNotifications] = useState([]);
  const seedDoneRef = useRef(false);
  const isSeedingRef = useRef(false);
  const lastMsgCountsRef = useRef({});
  const isPollingRef = useRef(false);
  const providerRef = useRef(null);
  const contractRef = useRef(null);

  const accountRef = useRef(account);
  const activeChatAddressRef = useRef(activeChatAddress);
  const friendListsRef = useRef(friendLists);
  const chatPrivateKeyRef = useRef(chatPrivateKey);
  const onActiveChatNewMessageRef = useRef(onActiveChatNewMessage);

  useEffect(() => { accountRef.current = account; }, [account]);
  useEffect(() => { activeChatAddressRef.current = activeChatAddress; }, [activeChatAddress]);
  useEffect(() => { friendListsRef.current = friendLists; }, [friendLists]);
  useEffect(() => { chatPrivateKeyRef.current = chatPrivateKey; }, [chatPrivateKey]);
  useEffect(() => { onActiveChatNewMessageRef.current = onActiveChatNewMessage; }, [onActiveChatNewMessage]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Load notifikasi + restore seed counts dari localStorage saat akun berubah
  useEffect(() => {
    if (account && typeof window !== "undefined") {
      const notifKey = `chat_notifications_${account.toLowerCase()}`;
      const saved = localStorage.getItem(notifKey);
      if (saved) {
        try { setNotifications(JSON.parse(saved)); }
        catch (e) { setNotifications([]); }
      } else {
        setNotifications([]);
      }

      const restored = loadSeedCounts(account);
      lastMsgCountsRef.current = restored;

      if (Object.keys(restored).length > 0) {
        seedDoneRef.current = true;
        isSeedingRef.current = false;
      } else {
        seedDoneRef.current = false;
        isSeedingRef.current = false;
      }
    } else {
      setNotifications([]);
      lastMsgCountsRef.current = {};
      seedDoneRef.current = false;
      isSeedingRef.current = false;
      providerRef.current = null;
      contractRef.current = null;
    }
  }, [account]);

  // ─── Notification helpers ───────────────────────────────────────────────────

  const addNotification = ({ type, title, text, address, detail }) => {
    const currentAcc = accountRef.current;
    if (!currentAcc) return;
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type, title, text,
      detail: detail || "",
      address: address || "",
      time: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev].slice(0, 50);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `chat_notifications_${currentAcc.toLowerCase()}`,
            JSON.stringify(updated)
          );
        } catch (err) { }
      }
      return updated;
    });
  };

  const markNotificationRead = (id) => {
    const currentAcc = accountRef.current;
    if (!currentAcc) return;
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `chat_notifications_${currentAcc.toLowerCase()}`,
            JSON.stringify(updated)
          );
        } catch (err) { }
      }
      return updated;
    });
  };

  const clearNotifications = () => {
    const currentAcc = accountRef.current;
    if (!currentAcc) return;
    setNotifications([]);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`chat_notifications_${currentAcc.toLowerCase()}`);
      } catch (err) { }
    }
  };

  const markFriendNotificationsRead = (friendAddress) => {
    const currentAcc = accountRef.current;
    if (!currentAcc || !friendAddress) return;
    setNotifications((prev) => {
      const hasUnread = prev.some(
        (n) => n.address.toLowerCase() === friendAddress.toLowerCase() && !n.read
      );
      if (!hasUnread) return prev;
      const updated = prev.map((n) =>
        n.address.toLowerCase() === friendAddress.toLowerCase()
          ? { ...n, read: true }
          : n
      );
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `chat_notifications_${currentAcc.toLowerCase()}`,
            JSON.stringify(updated)
          );
        } catch (err) { }
      }
      return updated;
    });
  };

  // ─── Contract helper ──────────────────────────────────────────────────────────

  const getContractInstance = async () => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    try {
      if (contractRef.current && providerRef.current) {
        return contractRef.current;
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(ChatAppAddress, ChatAppABI, signer);
      providerRef.current = provider;
      contractRef.current = contract;
      return contract;
    } catch (e) {
      return null;
    }
  };

  // ─── Seed ─────────────────────────────────────────────────────────────────────

  const seedCounts = async () => {
    if (isSeedingRef.current) return;

    const currentAcc = accountRef.current;
    const currentFriends = friendListsRef.current;

    if (!currentAcc || !currentFriends || currentFriends.length === 0) {
      seedDoneRef.current = true;
      return;
    }

    const unseeded = currentFriends.filter(
      (f) => lastMsgCountsRef.current[f.pubkey.toLowerCase()] === undefined
    );

    if (unseeded.length === 0) {
      seedDoneRef.current = true;
      return;
    }

    isSeedingRef.current = true;

    try {
      const contract = await getContractInstance();
      if (!contract) {
        seedDoneRef.current = true;
        isSeedingRef.current = false;
        return;
      }

      await Promise.allSettled(
        unseeded.map(async (friend) => {
          const key = friend.pubkey.toLowerCase();
          if (lastMsgCountsRef.current[key] !== undefined) return;
          try {
            const messages = await contract.readMessage(friend.pubkey);
            const incomingCount = messages.filter(
              (m) => m.sender.toLowerCase() === friend.pubkey.toLowerCase()
            ).length;
            lastMsgCountsRef.current[key] = incomingCount;
          } catch (e) {
            lastMsgCountsRef.current[key] = 0;
          }
        })
      );

      saveSeedCounts(currentAcc, { ...lastMsgCountsRef.current });
    } catch (e) {
      console.warn("[Notif] Seed error:", e.message);
    } finally {
      seedDoneRef.current = true;
      isSeedingRef.current = false;
    }
  };

  // ─── Polling ──────────────────────────────────────────────────────────────────

  const pollForNewMessages = async () => {
    if (!seedDoneRef.current) { return; }

    const currentAcc = accountRef.current;
    const currentFriends = friendListsRef.current;
    if (!currentAcc || !currentFriends || currentFriends.length === 0) { return; }

    try {
      const contract = await getContractInstance();
      if (!contract) return;

      for (const friend of currentFriends) {
        const friendAddr = friend.pubkey;
        const key = friendAddr.toLowerCase();
        try {
          const messages = await contract.readMessage(friendAddr);
          const incomingMsgs = messages.filter(
            (m) => m.sender.toLowerCase() === friendAddr.toLowerCase()
          );
          const incomingCount = incomingMsgs.length;
          const prevCount = lastMsgCountsRef.current[key];

          if (prevCount === undefined) {
            lastMsgCountsRef.current[key] = incomingCount;
            saveSeedCounts(currentAcc, { ...lastMsgCountsRef.current });
            continue;
          }

          if (prevCount > incomingCount) {
            lastMsgCountsRef.current[key] = incomingCount;
            saveSeedCounts(currentAcc, { ...lastMsgCountsRef.current });
            continue;
          }

          if (incomingCount > prevCount) {
            const isActiveChat =
              activeChatAddressRef.current &&
              friendAddr.toLowerCase() === activeChatAddressRef.current.toLowerCase();

            if (isActiveChat) {
              lastMsgCountsRef.current[key] = incomingCount;
              saveSeedCounts(currentAcc, { ...lastMsgCountsRef.current });
              if (onActiveChatNewMessageRef.current) {
                await onActiveChatNewMessageRef.current(friendAddr);
              }
              continue;
            }

            const newCount = incomingCount - prevCount;

            // Resolve nama pengirim
            let senderName = friend.name ? friend.name.split("#")[0] : "";
            if (!senderName || senderName === "Error Loading Profile") {
              const savedProfile =
                localStorage.getItem(`profile_${friendAddr.toLowerCase()}`) ||
                localStorage.getItem(`profile_${friendAddr}`);
              if (savedProfile) {
                try {
                  const parsed = JSON.parse(savedProfile);
                  if (parsed.displayName) senderName = parsed.displayName;
                } catch (e) { }
              }
            }
            if (!senderName || senderName === "Error Loading Profile") {
              senderName = `${friendAddr.slice(0, 6)}...${friendAddr.slice(-4)}`;
            }

            // Resolve preview pesan terbaru — fetch CID dari IPFS
            let latestMsgPreview = "";
            const latestMsg = incomingMsgs[incomingMsgs.length - 1];

            if (latestMsg) {
              // msgCid sekarang adalah CID IPFS, bukan teks langsung
              let rawMsg = "";
              try {
                rawMsg = await fetchFromIPFSWithTimeout(latestMsg.msgCid, 3000);
              } catch (e) {
                rawMsg = "__E2EE__:";
              }

              if (rawMsg.startsWith("__IPFS__:")) {
                latestMsgPreview = parseIPFSMsgPreview(rawMsg);
              } else if (rawMsg.startsWith("__E2EE__:")) {
                try {
                  let friendPubKey = friend.publicKey || null;
                  if (!friendPubKey) {
                    const saved =
                      localStorage.getItem(`profile_${friendAddr.toLowerCase()}`) ||
                      localStorage.getItem(`profile_${friendAddr}`);
                    if (saved) {
                      try {
                        const p = JSON.parse(saved);
                        if (p.chatPublicKey) friendPubKey = p.chatPublicKey;
                      } catch (e) { }
                    }
                  }

                  const privKey = chatPrivateKeyRef.current;
                  if (friendPubKey && privKey) {
                    const mySigningKey = new ethers.utils.SigningKey(privKey);
                    const sharedSecret = mySigningKey.computeSharedSecret(friendPubKey);
                    const aesKey = ethers.utils.keccak256(sharedSecret);
                    const { decryptMessage } = await import("../Utils/crypto");
                    const parts = rawMsg.split(":");
                    const decrypted = await decryptMessage(parts[1], parts[2], aesKey);
                    const resolvedText = parseIPFSMsgPreview(decrypted);
                    latestMsgPreview =
                      resolvedText.length > 80
                        ? resolvedText.slice(0, 80) + "..."
                        : resolvedText;
                  } else {
                    latestMsgPreview = "🔒 Pesan terenkripsi";
                  }
                } catch (err) {
                  latestMsgPreview = "🔒 Pesan terenkripsi";
                }
              } else {
                latestMsgPreview =
                  rawMsg.length > 80 ? rawMsg.slice(0, 80) + "..." : rawMsg;
              }
            }

            addNotification({
              type: "message_received",
              title: `Pesan dari ${senderName}`,
              text: newCount > 1 ? `${newCount} pesan baru` : latestMsgPreview,
              detail: newCount > 1 ? latestMsgPreview : "",
              address: friendAddr,
            });

            lastMsgCountsRef.current[key] = incomingCount;
            saveSeedCounts(currentAcc, { ...lastMsgCountsRef.current });
          }
        } catch (err) {
          // Skip teman yang belum punya riwayat pesan
        }
      }
    } catch (e) {
      console.warn("[Notif] Poll error:", e.message);
    }
  };

  // ─── Polling loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!account || !friendLists || friendLists.length === 0) {
      return;
    }

    let timeoutId;
    let cancelled = false;

    const runPollLoop = async () => {
      if (cancelled || isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        await pollForNewMessages();
      } catch (err) {
        console.error("[Notif] Error di poll loop:", err);
      } finally {
        isPollingRef.current = false;
        if (!cancelled) {
          timeoutId = setTimeout(runPollLoop, 5000);
        }
      }
    };

    seedCounts().then(() => {
      if (!cancelled) {
        timeoutId = setTimeout(runPollLoop, 5000);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      isPollingRef.current = false;
    };
  }, [account, friendLists]);

  return {
    notifications,
    unreadCount,
    addNotification,
    markNotificationRead,
    clearNotifications,
    markFriendNotificationsRead,
  };
};