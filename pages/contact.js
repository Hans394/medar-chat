import React, { useState, useEffect, useContext } from "react";
import Image from "next/image";

// INTERNAL IMPORT
import Style from "../styles/contact.module.css";
import { ChatAppContext } from "../Context/ChatAppContext";
import images from "../assets";

const ContactItem = ({ friend, index, refreshTrigger, account }) => {
  const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23111111"/><circle cx="50" cy="37" r="17" fill="%23ffffff"/><path d="M20 78 C20 60, 30 55, 50 55 C70 55, 80 60, 80 78 Z" fill="%23ffffff"/></svg>`;

  const getAvatarUrl = (avatarVal) => {
    if (avatarVal === null || avatarVal === undefined || avatarVal === "") return defaultAvatar;
    const num = Number(avatarVal);
    if (!isNaN(num) && num >= 0 && num < 10) {
      const avatarImages = [
        images.image1, images.image2, images.image3, images.image4,
        images.image5, images.image6, images.image7, images.image8,
        images.image9, images.image10
      ];
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

  // friend.name is already resolved (clean) from fetchData via resolveUserData
  const [displayName, setDisplayName] = useState(friend.name || "");
  const [avatarImg, setAvatarImg] = useState(() => getAvatarUrl(friend.avatarIndex));

  useEffect(() => {
    if (typeof window !== "undefined") {
      // friend.name is already a clean resolved name — no need to split "#"
      let nameToSet = friend.name || "";

      // Fall back to localStorage profile if name is empty or "Error Loading Profile"
      if (!nameToSet || nameToSet === "Error Loading Profile") {
        const savedProfile = localStorage.getItem(`profile_${friend.pubkey.toLowerCase()}`) || localStorage.getItem(`profile_${friend.pubkey}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.displayName) {
              nameToSet = parsed.displayName;
            }
          } catch (e) { }
        }
      }
      setDisplayName(nameToSet);

      // Load avatar from friend.avatarIndex or localStorage profile
      if (friend.avatarIndex !== undefined && friend.avatarIndex !== null && friend.avatarIndex !== "") {
        setAvatarImg(getAvatarUrl(friend.avatarIndex));
      } else {
        const savedProfile =
          localStorage.getItem(`profile_${friend.pubkey.toLowerCase()}`) ||
          localStorage.getItem(`profile_${friend.pubkey}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.avatarIndex !== undefined && parsed.avatarIndex !== null && parsed.avatarIndex !== "") {
              setAvatarImg(getAvatarUrl(parsed.avatarIndex));
            } else {
              setAvatarImg(defaultAvatar);
            }
          } catch (e) {
            setAvatarImg(defaultAvatar);
          }
        } else {
          setAvatarImg(defaultAvatar);
        }
      }
    }
  }, [friend.pubkey, friend.name, friend.avatarIndex, index, refreshTrigger, account]);

  return (
    <div className={Style.contact_item}>
      <Image
        src={avatarImg}
        alt="user"
        width={70}
        height={70}
        className={Style.contact_box_img}
        unoptimized
      />
      <div className={Style.contact_info}>
        <h3>{displayName}</h3>
        <p>{friend.pubkey}</p>
      </div>
    </div>
  );
};

const Contact = () => {
  const context = useContext(ChatAppContext);
  const { friendLists, addFriends, account, deleteFriend } = context || {};
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // States for Create Contact
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");



  // States for Blocked Contacts
  const [blockedList, setBlockedList] = useState([]);

  // Load blocked list
  useEffect(() => {
    if (account && typeof window !== "undefined") {
      const savedBlocked = localStorage.getItem(`blocked_users_${account.toLowerCase()}`);
      if (savedBlocked) {
        setBlockedList(JSON.parse(savedBlocked));
      } else {
        setBlockedList([]);
      }
    }
  }, [account, refreshTrigger]);

  // Handle Block contact locally
  const handleBlockContact = (pubkey) => {
    if (!account) return;
    const confirmBlock = window.confirm("Are you sure you want to block this contact? They will be removed from your lists.");
    if (confirmBlock) {
      const updatedBlocked = [...blockedList, pubkey.toLowerCase()];
      setBlockedList(updatedBlocked);
      localStorage.setItem(`blocked_users_${account.toLowerCase()}`, JSON.stringify(updatedBlocked));
      setRefreshTrigger(prev => prev + 1);
      alert("Contact blocked successfully.");
    }
  };



  // Handle Delete contact on blockchain
  const handleDeleteContact = async (pubkey) => {
    const confirmDelete = window.confirm("Are you sure you want to remove this contact from your friend list?");
    if (confirmDelete) {
      await deleteFriend(pubkey);
    }
  };

  // Handle Add/Create contact (contract call)
  const handleAddContactSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newAddress.trim()) {
      alert("Please fill in all fields.");
      return;
    }

    if (newAddress.trim().toLowerCase() === account.toLowerCase()) {
      alert("You cannot add yourself as a friend.");
      return;
    }

    await addFriends({ name: newName.trim(), userAddress: newAddress.trim() });
    setShowAddForm(false);
    setNewName("");
    setNewAddress("");
  };

  const activeContacts = friendLists
    ? friendLists.filter(
      (friend) =>
        !blockedList.includes(friend.pubkey.toLowerCase()) &&
        !blockedList.includes(friend.pubkey)
    )
    : [];

  return (
    <div className={Style.contact_container}>
      <div className={Style.contact_card}>
        {/* HEADER SECTION with Create button */}
        <div className={Style.contact_header}>
          <h2>My Contacts</h2>
          <button
            className={Style.add_btn}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <span>{showAddForm ? "Cancel" : "+ Add Contact"}</span>
          </button>
        </div>

        {/* CREATE CONTACT FORM */}
        {showAddForm && (
          <form className={Style.add_form_container} onSubmit={handleAddContactSubmit}>
            <h3>Add New Contact</h3>
            <div className={Style.input_group}>
              <label>Name</label>
              <input
                type="text"
                placeholder="Enter contact name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div className={Style.input_group}>
              <label>Wallet Address (Pubkey)</label>
              <input
                type="text"
                placeholder="0x..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                required
              />
            </div>
            <div className={Style.form_actions}>
              <button
                type="button"
                className={Style.cancel_btn}
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className={Style.submit_btn}>
                Add Friend
              </button>
            </div>
          </form>
        )}

        {/* READ / ACTIVE CONTACTS LIST */}
        {activeContacts.length > 0 ? (
          activeContacts.map((friend, index) => (
            <div key={index} className={Style.contact_item_wrapper}>
              <div className={Style.contact_flex_container}>
                <div className={Style.contact_item_left}>
                  <ContactItem friend={friend} index={index} refreshTrigger={refreshTrigger} account={account} />
                </div>
                <div className={Style.contact_actions}>
                  <button
                    className={Style.action_btn_block}
                    onClick={() => handleBlockContact(friend.pubkey)}
                  >
                    Block
                  </button>
                  <button
                    className={Style.action_btn_delete}
                    onClick={() => handleDeleteContact(friend.pubkey)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className={Style.separator_line}></div>
            </div>
          ))
        ) : (
          <div className={Style.no_contacts}>
            <h3>No contacts found</h3>
            <p>Add a contact above or explore "All Users" to find friends!</p>
          </div>
        )}


      </div>
    </div>
  );
};

export default Contact;