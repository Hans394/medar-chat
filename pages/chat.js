import React, { useState, useContext, useEffect } from "react";
import { useRouter } from "next/router";

// INTERNAL IMPORT
import { ChatAppContext } from "../Context/ChatAppContext";
import { Filter, Friend } from "../Components/index";

const ChatPage = () => {
  const { 
    account, 
    addFriends, 
    sendMessage, 
    readMessage, 
    friendLists, 
    readUserMsg, 
    userName, 
    userLists,
    friendMsg,
    isInitialising
  } = useContext(ChatAppContext);

  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Guard: Jika wallet belum terhubung, kembalikan ke home (Selamat Datang)
  useEffect(() => {
    if (isInitialising) return;
    if (!account) {
      router.push("/");
    }
  }, [account, isInitialising]);

  if (isInitialising || !account) return null;

  return (
    <div>
      <Filter searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <Friend 
        friendLists={friendLists} 
        readMessage={readMessage} 
        sendMessage={sendMessage} 
        friendMsg={friendMsg}
        searchQuery={searchQuery}
        account={account}
        userName={userName}
      />
    </div>
  );
};

export default ChatPage;
