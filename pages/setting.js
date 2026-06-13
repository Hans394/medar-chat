import React, { useState, useContext, useEffect } from "react";
import Image from "next/image";

// INTERNAL IMPORT
import Style from "../styles/setting.module.css";
import { ChatAppContext } from "../Context/ChatAppContext";
import images from "../assets";

const Setting = () => {
  const { userName, userAvatar, updateProfile, account, clearChatHistory, disconnectWallet, friendLists, notifSettingsRef } = useContext(ChatAppContext);
  const [activeSection, setActiveSection] = useState(null);
  const [displayName, setDisplayName] = useState(userName || "");
  const [selectedAvatar, setSelectedAvatar] = useState(userAvatar !== null ? userAvatar : null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notifNewMessages, setNotifNewMessages] = useState(
    notifSettingsRef ? notifSettingsRef.current.newMessages : true
  );
  const [notifFriendRequests, setNotifFriendRequests] = useState(
    notifSettingsRef ? notifSettingsRef.current.friendRequests : true
  );
  const [blockAddress, setBlockAddress] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [blockedList, setBlockedList] = useState([]);

  const handleCustomPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return alert("The selected file must be an image.");
    }

    try {
      setUploadingPhoto(true);
      const { uploadToIPFS } = await import("../Utils/ipfs");
      const uploadRes = await uploadToIPFS(file);
      if (uploadRes && uploadRes.cid) {
        setSelectedAvatar(uploadRes.cid);
      }
    } catch (err) {
      console.error("Custom photo upload failed:", err);
      alert(err.message || "Failed to upload custom photo to IPFS.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getBlockedUserName = (address) => {
    if (!address) return "Unknown User";
    const addrLower = address.toLowerCase();



    // 2. Cek profile di local storage
    const savedProfile = localStorage.getItem(`profile_${addrLower}`) || localStorage.getItem(`profile_${address}`);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.displayName) return parsed.displayName;
      } catch (e) {
        console.warn("Failed to parse profile from localStorage:", e);
      }
    }

    // 3. Cek di daftar teman
    if (friendLists) {
      const friend = friendLists.find(f => f.pubkey.toLowerCase() === addrLower);
      if (friend && friend.name) return friend.name;
    }

    return "Unknown User";
  };

  // Sinkronisasi state lokal ketika context berubah (misal: ganti akun)
  useEffect(() => {
    setDisplayName(userName || "");
    setSelectedAvatar(userAvatar !== null ? userAvatar : null);
  }, [userName, userAvatar]);


  // Fungsi simpan profil
  const handleSaveProfile = async () => {
    if (!account) return;

    setSaveSuccess(false);

    await updateProfile({
      displayName: displayName.trim() || userName,
      avatarIndex: selectedAvatar,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Fungsi clear chat history
  const handleClearChat = () => {
    const confirmClear = window.confirm(
      "Are you sure you want to clear the chat history from the UI cache? This only affects the screen display and does not delete messages from the blockchain."
    );
    if (confirmClear) {
      clearChatHistory();
      alert("Chat history UI cache cleared successfully!");
    }
  };

  // Fungsi disconnect wallet
  const handleDisconnect = () => {
    const confirmDisconnect = window.confirm("Are you sure you want to disconnect your wallet?");
    if (confirmDisconnect) {
      disconnectWallet();
    }
  };

  // Load blocked list dari localStorage
  useEffect(() => {
    if (account && typeof window !== "undefined") {
      const savedBlocked = localStorage.getItem(`blocked_users_${account.toLowerCase()}`);
      if (savedBlocked) {
        setBlockedList(JSON.parse(savedBlocked));
      } else {
        setBlockedList([]);
      }
    }
  }, [account]);

  // Fungsi Blokir Pengguna
  const handleBlockUser = () => {
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }
    const targetAddress = blockAddress.trim();
    if (!targetAddress) {
      alert("Please enter a valid wallet address.");
      return;
    }
    if (targetAddress.toLowerCase() === account.toLowerCase()) {
      alert("You cannot block yourself.");
      return;
    }
    if (blockedList.includes(targetAddress.toLowerCase()) || blockedList.includes(targetAddress)) {
      alert("This address is already blocked.");
      return;
    }

    const updatedBlocked = [...blockedList, targetAddress.toLowerCase()];
    setBlockedList(updatedBlocked);
    localStorage.setItem(`blocked_users_${account.toLowerCase()}`, JSON.stringify(updatedBlocked));
    setBlockAddress("");
    alert(`Successfully blocked: ${targetAddress}`);
  };

  // Fungsi Buka Blokir
  const handleUnblockUser = (addressToUnblock) => {
    if (!account) return;
    const updatedBlocked = blockedList.filter(addr => addr.toLowerCase() !== addressToUnblock.toLowerCase());
    setBlockedList(updatedBlocked);
    localStorage.setItem(`blocked_users_${account.toLowerCase()}`, JSON.stringify(updatedBlocked));
    alert(`Successfully unblocked: ${addressToUnblock}`);
  };

  const avatarList = [
    images.image1,
    images.image2,
    images.image3,
    images.image4,
    images.image5,
    images.image6,
    images.image7,
    images.image8,
    images.image9,
    images.image10,
  ];

  const settingsItems = [
    {
      key: "profile",
      title: "Profile Setting",
      subtitle: "Manage your profile and your avatar",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={Style.icon}
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      key: "notification",
      title: "Notification Setting",
      subtitle: "Configure notification",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={Style.icon}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      key: "privacy",
      title: "Privacy & Security",
      subtitle: "Security and privacy control",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={Style.icon}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      key: "danger",
      title: "Danger Zone",
      subtitle: "Disconnect and data management",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={Style.icon}
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      ),
    },
  ];

  // PROFILE SETTING SUB-PAGE
  if (activeSection === "profile") {
    return (
      <div className={Style.setting_container}>
        <div className={Style.setting_box}>
          {/* Back button */}
          <div
            className={Style.back_btn}
            onClick={() => setActiveSection(null)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={Style.back_arrow}
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to settings</span>
          </div>

          {/* Profile card */}
          <div className={Style.profile_card}>
            {/* Header */}
            <div className={Style.profile_header}>
              <div className={Style.icon_badge}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.icon}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className={Style.setting_text}>
                <h3>Profile Setting</h3>
                <p>Manage your profile and your avatar</p>
              </div>
            </div>

            {/* Display name */}
            <div className={Style.profile_section}>
              <label className={Style.profile_label}>Display name</label>
              <input
                type="text"
                className={Style.profile_input}
                placeholder="Username"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Choose avatar + Save */}
            <div className={Style.profile_section}>
              <div className={Style.avatar_header}>
                <label className={Style.profile_label}>Profile Picture</label>
                <button className={Style.save_btn} onClick={handleSaveProfile}>
                  {saveSuccess ? "✓ Saved!" : "Save"}
                </button>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2rem", marginTop: "1rem" }}>
                <div style={{ position: "relative", width: "120px", height: "120px" }}>
                  {selectedAvatar ? (
                    <img
                      src={typeof selectedAvatar === "string"
                        ? (selectedAvatar.startsWith("data:") || selectedAvatar.startsWith("/") || selectedAvatar.startsWith("http")
                          ? selectedAvatar
                          : `/api/ipfs?cid=${selectedAvatar}`)
                        : (selectedAvatar !== null && selectedAvatar !== undefined && !isNaN(Number(selectedAvatar)) && Number(selectedAvatar) >= 0 && Number(selectedAvatar) < 10
                          ? avatarList[Number(selectedAvatar)]
                          : images.accountName)
                      }
                      alt="Profile Avatar"
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "3px solid #B4FFB6", boxShadow: "0 0 15px rgba(180, 255, 182, 0.2)" }}
                    />
                  ) : (
                    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", borderRadius: "50%", border: "3px solid #B4FFB6", boxShadow: "0 0 15px rgba(180, 255, 182, 0.2)" }}>
                      <circle cx="50" cy="50" r="50" fill="#111111" />
                      <circle cx="50" cy="37" r="17" fill="#ffffff" />
                      <path d="M20 78 C20 60, 30 55, 50 55 C70 55, 80 60, 80 78 Z" fill="#ffffff" />
                    </svg>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "rgba(180, 255, 182, 0.1)",
                    color: "#B4FFB6",
                    border: "1.5px solid rgba(180, 255, 182, 0.4)",
                    padding: "0.6rem 1.2rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    fontWeight: "600",
                    transition: "all 0.2s"
                  }}>
                    📷 Upload New Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomPhotoUpload}
                      style={{ display: "none" }}
                      disabled={uploadingPhoto}
                    />
                  </label>
                  {uploadingPhoto && <span style={{ color: "#B4FFB6", fontSize: "0.95rem" }}>Uploading...</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NOTIFICATION SETTING SUB-PAGE
  if (activeSection === "notification") {
    return (
      <div className={Style.setting_container}>
        <div className={Style.setting_box}>
          {/* Back button */}
          <div
            className={Style.back_btn}
            onClick={() => setActiveSection(null)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={Style.back_arrow}
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to settings</span>
          </div>

          {/* Notification card */}
          <div className={Style.profile_card}>
            {/* Header */}
            <div className={Style.profile_header}>
              <div className={Style.icon_badge}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.icon}
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div className={Style.setting_text}>
                <h3>Notification setting</h3>
                <p>Manage your notification preferences</p>
              </div>
            </div>

            {/* Toggle items */}
            <div className={Style.toggle_list}>
              <div className={Style.toggle_item}>
                <div className={Style.toggle_info}>
                  <h4>New messages</h4>
                  <p>Get notified when you receive new messages</p>
                </div>
                <div
                  className={`${Style.toggle_switch} ${notifNewMessages ? Style.toggle_on : ""}`}
                  onClick={() => {
                    setNotifNewMessages(!notifNewMessages);
                  }}
                >
                  <div className={Style.toggle_knob}></div>
                </div>
              </div>

              <div className={Style.toggle_item}>
                <div className={Style.toggle_info}>
                  <h4>Friend Requests</h4>
                  <p>Get notified when someone sends you a friend request</p>
                </div>
                <div
                  className={`${Style.toggle_switch} ${notifFriendRequests ? Style.toggle_on : ""}`}
                  onClick={() => {
                    setNotifFriendRequests(!notifFriendRequests);
                  }}
                >
                  <div className={Style.toggle_knob}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PRIVACY & SECURITY SUB-PAGE
  if (activeSection === "privacy") {
    return (
      <div className={Style.setting_container}>
        <div className={Style.setting_box}>
          {/* Back button */}
          <div
            className={Style.back_btn}
            onClick={() => setActiveSection(null)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={Style.back_arrow}
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to settings</span>
          </div>

          {/* Privacy card */}
          <div className={Style.profile_card}>
            {/* Header */}
            <div className={Style.profile_header}>
              <div className={Style.icon_badge}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.icon}
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className={Style.setting_text}>
                <h3>Privacy and security</h3>
                <p>Manage your privacy and security settings</p>
              </div>
            </div>

            {/* Blocked users */}
            <div className={Style.profile_section}>
              <label className={Style.profile_label}>Blocked users</label>
              <div className={Style.block_row}>
                <input
                  type="text"
                  className={Style.profile_input}
                  placeholder="Enter wallet address to block"
                  value={blockAddress}
                  onChange={(e) => setBlockAddress(e.target.value)}
                />
                <button className={Style.save_btn} onClick={handleBlockUser}>Block</button>
              </div>
            </div>

            {/* Blocked list display */}
            <div className={Style.blocked_list_section}>
              <label className={Style.profile_label}>Blocked List</label>
              {blockedList.length > 0 ? (
                <div className={Style.blocked_list}>
                  {blockedList.map((addr, idx) => (
                    <div key={idx} className={Style.blocked_item}>
                      <div className={Style.blocked_user_info}>
                        <div className={Style.blocked_name}>{getBlockedUserName(addr)}</div>
                        <div className={Style.blocked_address}>{addr}</div>
                      </div>
                      <button
                        className={Style.unblock_btn}
                        onClick={() => handleUnblockUser(addr)}
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={Style.no_blocked_msg}>No blocked users</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DANGER ZONE SUB-PAGE
  if (activeSection === "danger") {
    return (
      <div className={Style.setting_container}>
        <div className={Style.setting_box}>
          {/* Back button */}
          <div
            className={Style.back_btn}
            onClick={() => setActiveSection(null)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={Style.back_arrow}
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to settings</span>
          </div>

          {/* Danger card */}
          <div className={Style.profile_card}>
            {/* Header */}
            <div className={Style.profile_header}>
              <div className={Style.icon_badge}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.icon}
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className={Style.setting_text}>
                <h3>Danger zone</h3>
                <p>Manage sensitive actions and data</p>
              </div>
            </div>

            {/* Clear chat history */}
            <div className={Style.danger_item}>
              <div className={Style.danger_item_header}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.danger_icon}
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <div>
                  <h4>Clear chat history</h4>
                  <p>Remove chat history from local storage only</p>
                </div>
              </div>
              <div className={Style.danger_warning}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.warning_icon}
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>This only clears the UI cache. Messages on the blockchain cannot be deleted.</span>
              </div>
              <button className={Style.danger_btn_orange} onClick={handleClearChat}>Clear</button>
            </div>

            {/* Disconnect wallet */}
            <div className={Style.danger_item_red}>
              <div className={Style.danger_item_header}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={Style.danger_icon}
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <div>
                  <h4>Disconnect wallet</h4>
                  <p>Disconnect your wallet from this application</p>
                </div>
              </div>
              <button className={Style.danger_btn_red} onClick={handleDisconnect}>Disconnect</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN SETTINGS LIST
  return (
    <div className={Style.setting_container}>
      <div className={Style.setting_box}>
        {settingsItems.map((item, index) => (
          <div
            key={index}
            className={Style.setting_card}
            onClick={() => setActiveSection(item.key)}
          >
            <div className={Style.setting_card_left}>
              <div className={Style.icon_badge}>{item.icon}</div>
              <div className={Style.setting_text}>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </div>
            </div>
            <div className={Style.setting_card_right}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={Style.arrow_icon}
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Setting;