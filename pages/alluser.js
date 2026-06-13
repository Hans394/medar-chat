import React, { useState, useEffect, useContext } from "react";

// INTERNAL IMPORT
import { UserCard } from "../Components/index";
import Style from "../styles/alluser.module.css";
import { ChatAppContext } from "../Context/ChatAppContext";

const AllUser = () => {
  const { userLists, addFriends, account, friendLists } = useContext(ChatAppContext);

  // Filter akun sendiri dan akun yang sudah berteman
  const filteredUsers = userLists.filter((el) => {
    // Filter akun sendiri
    if (account && el.accountAddress.toLowerCase() === account.toLowerCase()) {
      return false;
    }
    // Filter akun yang sudah ditambahkan sebagai teman
    if (
      friendLists &&
      friendLists.some(
        (friend) => friend.pubkey.toLowerCase() === el.accountAddress.toLowerCase()
      )
    ) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className={Style.alluser_info}>
        <h1>Find Your Friends</h1>
      </div>

      <div className={Style.alluser}>
        {filteredUsers.map((el, i) => (
          <UserCard 
            key={i + 1} 
            el={el} 
            i={i} 
            addFriends={addFriends} 
          />
        ))}
      </div>
    </div>
  );
};

export default AllUser;