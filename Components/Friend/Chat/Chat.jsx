import React, { useState, useEffect, useContext } from "react";
import Image from "next/image";

// INTERNAL IMPORT
import Style from "./Chat.module.css";
import images from "../../../assets";
import { convertTime } from "../../../Utils/apiFeature";
import { ChatAppContext } from "../../../Context/ChatAppContext";
import { uploadToIPFS } from "../../../Utils/ipfs";

const IPFSAttachment = ({ cid, fileName, fileType, openFilePreview }) => {
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadUrl = async () => {
      if (!cid) return;

      if (!cid.startsWith("mockcid_")) {
        const url = `/api/ipfs?cid=${encodeURIComponent(cid)}`;
        if (active) {
          setGatewayUrl(url);
          setLoading(false);
        }
        return;
      }

      if (typeof window !== "undefined") {
        let cached = localStorage.getItem(`mock_ipfs_${cid}`);
        if (cached) {
          if (active) {
            setGatewayUrl(cached);
            setLoading(false);
          }
          return;
        }

        try {
          console.log(`IPFSAttachment: Fetching /api/ipfs?cid=${cid} from server...`);
          const res = await fetch(`/api/ipfs?cid=${encodeURIComponent(cid)}`);
          if (res.ok) {
            const dataUrl = await res.text();
            console.log(`IPFSAttachment: Successfully fetched content for CID ${cid}, length: ${dataUrl.length}`);
            try {
              localStorage.setItem(`mock_ipfs_${cid}`, dataUrl);
            } catch (storageErr) {
              console.warn("IPFSAttachment: Failed to cache in localStorage:", storageErr);
            }
            if (active) {
              setGatewayUrl(dataUrl);
            }
          } else {
            console.error(`IPFSAttachment: Failed to fetch mock IPFS file from server. Status: ${res.status}`);
          }
        } catch (error) {
          console.error(`IPFSAttachment: Error loading mock IPFS file:`, error);
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }
    };

    loadUrl();
    return () => {
      active = false;
    };
  }, [cid]);

  if (loading) {
    return (
      <div className={Style.chat_media_loading}>
        <div className={Style.ipfs_loader}></div>
        <span>Memuat berkas...</span>
      </div>
    );
  }

  if (!gatewayUrl) {
    return (
      <div className={Style.chat_media_error}>
        ⚠️ Gagal memuat berkas (URL kosong)
      </div>
    );
  }

  if (fileType.startsWith("image/")) {
    return (
      <div
        className={Style.chat_media_image}
        onClick={() => openFilePreview(gatewayUrl, fileType, fileName)}
        style={{ cursor: "pointer" }}
      >
        <img src={gatewayUrl} alt={fileName} className={Style.chat_ipfs_image} />
        <div className={Style.chat_media_meta}>
          <span className={Style.chat_media_filename}>{fileName}</span>
          <a
            href={gatewayUrl}
            download={fileName}
            className={Style.chat_download_btn}
            title="Download Image"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Unduh
          </a>
        </div>
      </div>
    );
  } else {
    return (
      <div
        className={Style.chat_media_file}
        onClick={() => openFilePreview(gatewayUrl, fileType, fileName)}
        style={{ cursor: "pointer" }}
      >
        <div className={Style.chat_file_icon_wrapper}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div className={Style.chat_file_info}>
          <span className={Style.chat_file_link}>
            {fileName}
          </span>
          <span className={Style.chat_file_size}>IPFS Document</span>
        </div>
        <a
          href={gatewayUrl}
          download={fileName}
          className={Style.chat_download_btn_file}
          title="Download File"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Unduh
        </a>
      </div>
    );
  }
};

const Chat = ({ sendMessage, friendMsg, chatData, account, userName, setChatData }) => {
  const { userAvatar, chatPublicKey, friendLists, activeFriendPubKey, deriveChatKeys, readMessage } = useContext(ChatAppContext);

  const isE2EEActive = !!chatPublicKey && !!activeFriendPubKey;
  const [msg, setMsg] = useState("");
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [receiverAvatar, setReceiverAvatar] = useState(images.accountName);
  const [isBlockedByReceiver, setIsBlockedByReceiver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [friendDisplayName, setFriendDisplayName] = useState(chatData.name || "");

  useEffect(() => {
    if (typeof window !== "undefined" && chatData.address) {
      let resolvedName = chatData.name || "";

      // 1. Check profile in local storage if empty or "Error Loading Profile"
      if (!resolvedName || resolvedName === "Error Loading Profile") {
        const savedProfile = localStorage.getItem(`profile_${chatData.address.toLowerCase()}`) || localStorage.getItem(`profile_${chatData.address}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.displayName) resolvedName = parsed.displayName;
          } catch (e) { }
        }
      }

      // 2. Check in friend list if still empty or "Error Loading Profile"
      if ((!resolvedName || resolvedName === "Error Loading Profile") && friendLists) {
        const friend = friendLists.find(f => f.pubkey.toLowerCase() === chatData.address.toLowerCase());
        if (friend && friend.name) resolvedName = friend.name;
      }

      setFriendDisplayName(resolvedName || chatData.address);
    } else {
      setFriendDisplayName(chatData.name || "");
    }
  }, [chatData.address, chatData.name, account, friendLists]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi ukuran file — mock IPFS (localStorage) tidak bisa handle file besar
    // karena konversi ke base64 memblokir main thread dan menyebabkan MetaMask tidak muncul
    const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;
    const usingMockIPFS = !pinataJwt || pinataJwt === "YOUR_PINATA_JWT" || pinataJwt === "PASTE_JWT_KAMU_DI_SINI";
    const maxSizeMB = usingMockIPFS ? 1 : 25;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      alert(
        usingMockIPFS
          ? `Ukuran file maksimal ${maxSizeMB}MB untuk mode demo (Mock IPFS).\n\nFile kamu: ${(file.size / 1024 / 1024).toFixed(1)}MB.\n\nUntuk file lebih besar, isi NEXT_PUBLIC_PINATA_JWT di file .env.local dengan JWT dari pinata.cloud (gratis).`
          : `Ukuran file maksimal ${maxSizeMB}MB.\n\nFile kamu: ${(file.size / 1024 / 1024).toFixed(1)}MB.`
      );
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);

      // Beri waktu browser untuk render state "uploading" sebelum operasi berat
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = await uploadToIPFS(file);

      // Beri jeda kecil setelah upload sebelum trigger MetaMask
      // agar main thread tidak langsung terbebani dua operasi besar berurutan
      await new Promise((resolve) => setTimeout(resolve, 100));

      // CATATAN KEAMANAN (Bug #14): Hanya referensi IPFS (CID, fileName, fileType)
      // yang dienkripsi E2EE melalui sendMessage. File aktual di IPFS disimpan
      // TANPA enkripsi — siapa pun yang tahu CID bisa mengaksesnya.
      // TODO: Enkripsi file sebelum upload ke IPFS menggunakan shared secret
      // dari key exchange E2EE, lalu dekripsi di sisi penerima saat preview.
      const ipfsMsg = `__IPFS__:${result.cid}:${result.fileName}:${result.fileType}`;
      await sendMessage({ msg: ipfsMsg, address: chatData.address });
      setUploading(false);
    } catch (error) {
      console.error("IPFS upload failed:", error);
      alert(error.message || "Gagal mengupload file. Coba lagi.");
      setUploading(false);
    }
    e.target.value = "";
  };

  const openFilePreview = (url, fileType, fileName) => {
    if (!url) {
      alert("Pratinjau tidak tersedia: URL berkas kosong.");
      return;
    }

    // Escape HTML untuk mencegah XSS — nama file dari pengguna bisa mengandung tag berbahaya
    const escapeHtml = (str) => {
      if (!str) return "";
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeFileName = escapeHtml(fileName);
    const safeUrl = escapeHtml(url);

    if (url.startsWith("data:") || url.startsWith("blob:")) {
      const newWindow = window.open("", "_blank");
      if (!newWindow) {
        alert("Pop-up diblokir. Harap izinkan pop-up untuk melihat berkas.");
        return;
      }

      let viewerHtml = "";

      if (fileType.startsWith("image/")) {
        viewerHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${safeFileName || "Pratinjau Gambar"}</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  background-color: #0f0c1b;
                  color: #fff;
                  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  overflow: hidden;
                }
                .container {
                  position: relative;
                  max-width: 90%;
                  max-height: 85vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 20px 50px rgba(0,0,0,0.6);
                  border-radius: 12px;
                  overflow: hidden;
                  border: 1px solid rgba(255,255,255,0.1);
                  background: #151026;
                }
                img {
                  max-width: 100%;
                  max-height: 85vh;
                  object-fit: contain;
                  display: block;
                  transition: transform 0.3s ease;
                }
                .header {
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  background: linear-gradient(to bottom, rgba(15, 12, 27, 0.95), rgba(15, 12, 27, 0));
                  padding: 20px 30px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  z-index: 10;
                  opacity: 0;
                  transition: opacity 0.3s ease;
                }
                body:hover .header {
                  opacity: 1;
                }
                .filename {
                  font-weight: 600;
                  font-size: 1.1rem;
                  color: #CCFFBD;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                }
                .actions {
                  display: flex;
                  gap: 12px;
                }
                .btn {
                  background: rgba(204, 255, 189, 0.1);
                  border: 1px solid rgba(204, 255, 189, 0.3);
                  color: #CCFFBD;
                  padding: 8px 20px;
                  border-radius: 20px;
                  cursor: pointer;
                  text-decoration: none;
                  font-size: 0.9rem;
                  font-weight: 600;
                  transition: all 0.2s ease;
                  backdrop-filter: blur(8px);
                }
                .btn:hover {
                  background: #CCFFBD;
                  color: #120b1b;
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(204, 255, 189, 0.3);
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="filename">${safeFileName || "Gambar"}</div>
                <div class="actions">
                  <a class="btn" href="${safeUrl}" download="${safeFileName || 'image.png'}">Unduh</a>
                </div>
              </div>
              <div class="container">
                <img src="${safeUrl}" alt="${safeFileName || 'Pratinjau'}" />
              </div>
            </body>
          </html>
        `;
      } else if (fileType === "application/pdf") {
        viewerHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${safeFileName || "Pratinjau PDF"}</title>
              <meta charset="utf-8">
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  background-color: #0f0c1b;
                  height: 100vh;
                  display: flex;
                  flex-direction: column;
                }
                iframe {
                  width: 100%;
                  height: 100%;
                  border: none;
                }
              </style>
            </head>
            <body>
              <iframe src="${safeUrl}"></iframe>
            </body>
          </html>
        `;
      } else {
        viewerHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${safeFileName || "Pratinjau Berkas"}</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  background-color: #0f0c1b;
                  color: #fff;
                  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                }
                .card {
                  background: #151026;
                  border: 1px solid rgba(204,255,189,0.15);
                  border-radius: 16px;
                  padding: 40px;
                  text-align: center;
                  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                  max-width: 450px;
                  width: 90%;
                }
                .icon {
                  font-size: 4rem;
                  margin-bottom: 20px;
                }
                h2 {
                  margin: 0 0 10px 0;
                  font-size: 1.5rem;
                  color: #CCFFBD;
                }
                p {
                  color: rgba(255,255,255,0.6);
                  margin: 0 0 30px 0;
                  font-size: 0.95rem;
                  word-break: break-all;
                  line-height: 1.5;
                }
                .btn {
                  display: inline-block;
                  background: #CCFFBD;
                  color: #120b1b;
                  padding: 12px 35px;
                  border-radius: 25px;
                  text-decoration: none;
                  font-weight: 600;
                  transition: all 0.3s ease;
                  box-shadow: 0 4px 15px rgba(204, 255, 189, 0.2);
                }
                .btn:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 6px 20px rgba(204, 255, 189, 0.4);
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">📎</div>
                <h2>${safeFileName || "Berkas"}</h2>
                <p>Pratinjau tidak didukung untuk tipe berkas ini (${escapeHtml(fileType) || "unknown"}). Silakan unduh berkas untuk membukanya.</p>
                <a class="btn" href="${safeUrl}" download="${safeFileName || 'file'}">Unduh Berkas</a>
              </div>
            </body>
          </html>
        `;
      }

      newWindow.document.write(viewerHtml);
      newWindow.document.close();
    } else {
      window.open(url, "_blank");
    }
  };

  const renderMessageContent = (messageText) => {
    if (messageText && messageText.startsWith("__IPFS__:")) {
      const parts = messageText.split(":");
      const cid = parts[1];
      const fileName = parts[2];
      const fileType = parts[3] || "";

      return (
        <IPFSAttachment
          cid={cid}
          fileName={fileName}
          fileType={fileType}
          openFilePreview={openFilePreview}
        />
      );
    }
    return <p>{messageText}</p>;
  };

  const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23111111"/><circle cx="50" cy="37" r="17" fill="%23ffffff"/><path d="M20 78 C20 60, 30 55, 50 55 C70 55, 80 60, 80 78 Z" fill="%23ffffff"/></svg>`;

  const avatarImages = [
    images.image1,
    images.image2,
    images.image3,
    images.image4,
    images.image5,
    images.image6,
    images.image7,
    images.image8,
    images.image9,
    images.image10
  ];

  const getAvatarUrl = (avatarVal) => {
    if (avatarVal === null || avatarVal === undefined || avatarVal === "") return defaultAvatar;
    const num = Number(avatarVal);
    if (!isNaN(num) && num >= 0 && num < 10) {
      return avatarImages[num];
    }
    if (typeof avatarVal === "string") {
      if (avatarVal.startsWith("data:") || avatarVal.startsWith("/") || avatarVal.startsWith("http")) {
        return avatarVal;
      }
      return `/api/ipfs?cid=${avatarVal}`;
    }
    return defaultAvatar;
  };

  const [userAvatarImg, setUserAvatarImg] = useState(defaultAvatar);

  // Sync user's own avatar from userAvatar state or localStorage
  useEffect(() => {
    if (userAvatar !== null && userAvatar !== undefined && userAvatar !== "") {
      setUserAvatarImg(getAvatarUrl(userAvatar));
    } else if (typeof window !== "undefined" && account) {
      const savedProfile = localStorage.getItem(`profile_${account.toLowerCase()}`) || localStorage.getItem(`profile_${account}`);
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed.avatarIndex !== undefined && parsed.avatarIndex !== null && parsed.avatarIndex !== "") {
            setUserAvatarImg(getAvatarUrl(parsed.avatarIndex));
            return;
          }
        } catch (e) { }
      }
      setUserAvatarImg(defaultAvatar);
    } else {
      setUserAvatarImg(defaultAvatar);
    }
  }, [userAvatar, account]);

  const filteredMessages = friendMsg
    ? friendMsg.filter((m) =>
      m.msg.toLowerCase().includes(msgSearchQuery.toLowerCase())
    )
    : [];

  const handleSend = async () => {
    if (!msg.trim() || isBlockedByReceiver) return;
    const currentMsg = msg;
    setMsg("");
    await sendMessage({ msg: currentMsg, address: chatData.address });
  };

  // Dynamically load receiver (friend) avatar index from friendLists or localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && chatData.address) {
      // 1. Coba cari di friendLists terlebih dahulu (data on-chain/IPFS terbaru)
      if (friendLists) {
        const friend = friendLists.find(f => f.pubkey.toLowerCase() === chatData.address.toLowerCase());
        if (friend && friend.avatarIndex !== undefined && friend.avatarIndex !== null && friend.avatarIndex !== "") {
          setReceiverAvatar(getAvatarUrl(friend.avatarIndex));
          return;
        }
      }

      // 2. Coba fallback ke localStorage
      const savedProfile = localStorage.getItem(`profile_${chatData.address.toLowerCase()}`) || localStorage.getItem(`profile_${chatData.address}`);
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed.avatarIndex !== undefined && parsed.avatarIndex !== null && parsed.avatarIndex !== "") {
            setReceiverAvatar(getAvatarUrl(parsed.avatarIndex));
            return;
          }
        } catch (e) {
          console.warn("Failed to parse profile from localStorage:", e);
        }
      }
    }
    setReceiverAvatar(defaultAvatar);
  }, [chatData.address, friendLists]);

  // Cek apakah kita (account) telah memblokir lawan chat
  // Catatan: menggunakan daftar blokir milik kita sendiri,
  // karena localStorage tidak bisa diakses lintas browser/device.
  useEffect(() => {
    if (typeof window !== "undefined" && account && chatData.address) {
      const myBlockedList =
        localStorage.getItem(`blocked_users_${account.toLowerCase()}`);

      if (myBlockedList) {
        try {
          const parsed = JSON.parse(myBlockedList);
          setIsBlockedByReceiver(
            parsed.includes(chatData.address.toLowerCase()) ||
            parsed.includes(chatData.address)
          );
        } catch (e) {
          console.warn("Failed to parse blocked list:", e);
          setIsBlockedByReceiver(false);
        }
      } else {
        setIsBlockedByReceiver(false);
      }
    } else {
      setIsBlockedByReceiver(false);
    }
  }, [account, chatData.address]);

  return (
    <div className={Style.Chat}>
      {chatData.name && chatData.address ? (
        <>
          <div className={Style.Chat_user_contact}>
            {/* BACK BUTTON FOR MOBILE */}
            <button onClick={() => setChatData && setChatData({ name: "", address: "" })} className={Style.Chat_back_btn} aria-label="Back to contacts list">
              &larr;
            </button>
            <div className={Style.Chat_user_contact_img}>
              <Image src={receiverAvatar} alt="image" width={50} height={50} className={Style.Chat_contact_avatar} unoptimized />
            </div>
            <div className={Style.Chat_user_contact_info}>
              <div className={Style.Chat_user_contact_title}>
                <h4>{friendDisplayName || ""}</h4>
                {isE2EEActive ? (
                  <span className={Style.Chat_e2e_badge} title="Messages are encrypted end-to-end">🔒 E2EE</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className={Style.Chat_plain_badge} title="Receiver does not support E2EE. Messages sent will be unencrypted.">⚠️ Plaintext</span>
                    {!chatPublicKey && activeFriendPubKey && (
                      <button
                        className={Style.Chat_unlock_btn}
                        onClick={() => deriveChatKeys(account, true).then(() => readMessage(chatData.address))}
                        title="Unlock encryption keys to secure this chat"
                      >
                        Unlock Chat
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p>{chatData.address ? `${chatData.address.slice(0, 8)}...${chatData.address.slice(-6)}` : ""}</p>
            </div>
            <div className={Style.Chat_user_contact_search}>
              <Image src={images.search} alt="search" width={20} height={20} />
              <input
                type="text"
                placeholder="Search messages..."
                value={msgSearchQuery}
                onChange={(e) => setMsgSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={Style.Chat_box_section}>
            <div className={Style.Chat_box}>
              <div className={Style.Chat_box_left}>
                {isE2EEActive ? (
                  <div className={Style.Chat_e2e_info_card}>
                    <p>🔒 Messages are end-to-end encrypted. No one outside of this chat, not even the DApp, can read them.</p>
                  </div>
                ) : (
                  <div className={Style.Chat_plain_info_card}>
                    <p>⚠️ Messages in this chat are NOT end-to-end encrypted because this contact has not registered E2EE keys.</p>
                  </div>
                )}
                {filteredMessages.length > 0 ? (
                  filteredMessages.map((el, i) => (
                    <div key={i + 1}>
                      {el.sender === chatData.address ? (
                        /* RECEIVED MESSAGE (LEFT) */
                        <div className={Style.Chat_message_left}>
                          <div className={Style.Chat_message_avatar}>
                            <Image src={receiverAvatar} alt="avatar" width={40} height={40} className={Style.Chat_avatar_img} unoptimized />
                          </div>
                          <div className={Style.Chat_message_content}>
                            <div className={Style.Chat_message_header}>
                              <span className={Style.Chat_message_name}>{friendDisplayName || ""}</span>
                              <span className={Style.Chat_message_time}>
                                {el.isEncrypted && <span className={Style.Chat_lock_icon} title="End-to-End Encrypted">🔒 </span>}
                                {convertTime(el.timestamp)}
                              </span>
                            </div>
                            <div className={Style.Chat_message_bubble_left}>
                              {renderMessageContent(el.msg)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* SENT MESSAGE (RIGHT) */
                        <div className={Style.Chat_message_right}>
                          <div className={Style.Chat_message_avatar}>
                            <Image src={userAvatarImg} alt="avatar" width={40} height={40} className={Style.Chat_avatar_img} unoptimized />
                          </div>
                          <div className={Style.Chat_message_content}>
                            <div className={Style.Chat_message_header}>
                              <span className={Style.Chat_message_name}>{userName || "You"}</span>
                              <span className={Style.Chat_message_time}>
                                {el.isEncrypted && <span className={Style.Chat_lock_icon} title="End-to-End Encrypted">🔒 </span>}
                                {convertTime(el.timestamp)}
                                {el.isEncrypted ? (
                                  <span className={Style.Chat_ticks_icon_blue} title="End-to-End Encrypted & Delivered on Blockchain"> ✓✓</span>
                                ) : (
                                  <span className={Style.Chat_ticks_icon_gray} title="Delivered on Blockchain (Plaintext)"> ✓✓</span>
                                )}
                              </span>
                            </div>
                            <div className={Style.Chat_message_bubble_right}>
                              {renderMessageContent(el.msg)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : msgSearchQuery ? (
                  <div className={Style.Chat_no_messages}>
                    <p>No messages matching "{msgSearchQuery}"</p>
                  </div>
                ) : (
                  ""
                )}
              </div>
            </div>

            <div className={Style.Chat_send}>
              <div className={Style.Chat_send_box}>
                <Image src={images.smile} alt="smile" width={30} height={30} className={Style.Chat_send_icon} />
                <input
                  type="text"
                  placeholder={isBlockedByReceiver ? "Anda telah memblokir pengguna ini" : "type your message"}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSend();
                    }
                  }}
                  disabled={isBlockedByReceiver || uploading}
                />

                {uploading ? (
                  <div className={Style.ipfs_loader} title="Uploading to IPFS..." />
                ) : (
                  <>
                    <input
                      type="file"
                      id="ipfs-file-input"
                      style={{ display: "none" }}
                      onChange={handleFileUpload}
                      disabled={isBlockedByReceiver}
                    />
                    <label
                      htmlFor="ipfs-file-input"
                      style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                      title="Upload file (maks. 1MB untuk mode demo)"
                    >
                      <Image src={images.file} alt="file" width={30} height={30} className={Style.Chat_send_icon} />
                    </label>
                  </>
                )}
                {/* BUTTON SEND */}
                <button
                  onClick={handleSend}
                  className={Style.Chat_send_btn}
                  disabled={isBlockedByReceiver}
                  aria-label="Send message"
                >
                  <Image
                    src={images.send}
                    alt="send"
                    width={20}
                    height={20}
                  />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={Style.Chat_no_selected}>
          <div className={Style.Chat_no_selected_content}>
            <Image src={images.buddy} alt="No active chat" width={200} height={200} className={Style.Chat_no_selected_img} />
            <h3>Start a Conversation</h3>
            <p>Select a friend from the sidebar to begin messaging securely.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;