import React, { useState, useEffect } from "react";
import Image from "next/image";

// INTERNAL IMPORT
import Style from "./UserCard.module.css";
import images from "../../assets";

const UserCard = ({ el, i, addFriends }) => {
  
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
      if (avatarVal.startsWith("mockcid_") && typeof window !== "undefined") {
        if (!localStorage.getItem(`mock_ipfs_${avatarVal}`)) {
          return defaultAvatar;
        }
      }
      return `/api/ipfs?cid=${avatarVal}`;
    }
    return defaultAvatar;
  };

  const [displayName, setDisplayName] = useState(el.name || "");
  const [avatarImg, setAvatarImg] = useState(() => getAvatarUrl(el.avatarIndex));

  // Sync displayName if el.name changes (e.g. after IPFS resolves)
  useEffect(() => {
    if (el.name) setDisplayName(el.name);
  }, [el.name]);

  // Load avatar from localStorage/el metadata
  useEffect(() => {
    if (el.avatarIndex !== undefined && el.avatarIndex !== null && el.avatarIndex !== "") {
      setAvatarImg(getAvatarUrl(el.avatarIndex));
      return;
    }
    if (typeof window === "undefined") return;
    const savedProfile =
      localStorage.getItem(`profile_${el.accountAddress.toLowerCase()}`) ||
      localStorage.getItem(`profile_${el.accountAddress}`);
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.avatarIndex !== undefined && parsed.avatarIndex !== null) {
          setAvatarImg(getAvatarUrl(parsed.avatarIndex));
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [el.accountAddress, el.avatarIndex]);

  return (
    <div className={Style.UserCard}>
      <div className={Style.UserCard_box}>
        <Image
          className={Style.UserCard_box_img}
          src={avatarImg}
          alt="user"
          width={100}
          height={100}
          unoptimized
        />

        <div className={Style.UserCard_box_info}>
          <h3>{displayName}</h3>
          <p>{el.accountAddress.slice(0, 25)}..</p>
          <button
            onClick={() =>
              addFriends({ name: displayName, userAddress: el.accountAddress })
            }
          >
            Add Friend
          </button>
        </div>
      </div>

      <span className={Style.number}>{i + 1}</span>
    </div>
  );
};

export default UserCard;