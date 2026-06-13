import React, { useState, useEffect, useContext } from "react";
import Image from "next/image";
import Style from "./Friend.module.css";
import images from "../../assets";
import Card from "./Card/Card";
import Chat from "./Chat/Chat";

const Friend = ({ friendLists, readMessage, sendMessage, friendMsg, account, userName, searchQuery }) => {
  const [chatData, setChatData] = useState({
    name: "",
    address: "",
  });
  const [blockedList, setBlockedList] = useState([]);

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

  // Saring daftar teman agar teman yang diblokir tidak muncul dan cocok dengan query pencarian
  const activeFriends = friendLists
    ? friendLists.filter((friend) => {
      const isBlocked =
        blockedList.includes(friend.pubkey.toLowerCase()) ||
        blockedList.includes(friend.pubkey);
      if (isBlocked) return false;

      if (!searchQuery) return true;

      let displayName = friend.name;
      if (account) {
        const savedProfile = localStorage.getItem(`profile_${friend.pubkey.toLowerCase()}`) || localStorage.getItem(`profile_${friend.pubkey}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            if (parsed.displayName) displayName = parsed.displayName;
          } catch (e) { }
        }
      }

      const query = searchQuery.toLowerCase();
      return (
        displayName.toLowerCase().includes(query) ||
        friend.pubkey.toLowerCase().includes(query)
      );
    })
    : [];

  const hasActiveChat = chatData.address ? true : false;

  return (
    <div className={Style.Friend}>
      <div className={`${Style.Friend_box} ${hasActiveChat ? Style.active_chat : ""}`}>
        <div className={Style.Friend_box_left}>
          {activeFriends.map((el, i) => (
            <Card key={i + 1} el={el} i={i} readMessage={readMessage} setChatData={setChatData} />
          ))}
        </div>
        <div className={Style.Friend_box_right}>
          <Chat sendMessage={sendMessage} friendMsg={friendMsg} chatData={chatData} account={account} setChatData={setChatData} userName={userName} />
        </div>
      </div>
    </div>
  );
};

export default Friend;