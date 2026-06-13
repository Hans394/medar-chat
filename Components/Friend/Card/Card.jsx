import React, { useState, useEffect, useContext } from "react";
import Image from "next/image";

// INTERNAL IMPORT
import Style from "./Card.module.css";
import images from "../../../assets";
import { ChatAppContext } from "../../../Context/ChatAppContext";

const Card = ({ el, i, readMessage, setChatData }) => {
  const { account, notifications, markFriendNotificationsRead } = useContext(ChatAppContext);
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

  const [displayName, setDisplayName] = useState(el.name);
  const [avatarImg, setAvatarImg] = useState(() => getAvatarUrl(el.avatarIndex));

  const unreadCount = (notifications || []).filter(
    (n) => n.address.toLowerCase() === el.pubkey.toLowerCase() && !n.read
  ).length;

  useEffect(() => {
    if (typeof window !== "undefined") {
      // el.name is already resolved (clean name) from fetchData via resolveUserData
      // Do NOT split "#" — the name is already clean
      let nameToSet = el.name || "";

      // Fall back to localStorage profile if name is empty or "Error Loading Profile"
      if (!nameToSet || nameToSet === "Error Loading Profile") {
        const savedProfile = localStorage.getItem(`profile_${el.pubkey.toLowerCase()}`) || localStorage.getItem(`profile_${el.pubkey}`);
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

      // Load avatar from el.avatarIndex or localStorage profile
      if (el.avatarIndex !== undefined && el.avatarIndex !== null && el.avatarIndex !== "") {
        setAvatarImg(getAvatarUrl(el.avatarIndex));
      } else {
        const savedProfile = localStorage.getItem(`profile_${el.pubkey.toLowerCase()}`) || localStorage.getItem(`profile_${el.pubkey}`);
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
  }, [el.pubkey, el.name, el.avatarIndex, i, account]);

  return (
    <div
      className={Style.Card}
      onClick={() => {
        readMessage(el.pubkey);
        setChatData({ name: displayName, address: el.pubkey });
        // FIX: Tandai semua notifikasi dari teman ini sebagai sudah dibaca
        markFriendNotificationsRead(el.pubkey);
      }}
    >
      <div className={Style.Card_box}>
        <div className={Style.Card_box_left}>
          <Image
            src={avatarImg}
            alt="user"
            width={50}
            height={50}
            className={Style.Card_box_left_img}
            unoptimized
          />
        </div>
        <div className={Style.Card_box_right}>
          <div className={Style.Card_box_right_middle}>
            <h4>{displayName}</h4>
            <small>{el.pubkey.slice(0, 20)}..</small>
          </div>
          <div className={Style.Card_box_right_end}>
            {unreadCount > 0 && (
              <span className={Style.Card_notif_badge}>{unreadCount}</span>
            )}
            <small>{i + 1}</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;