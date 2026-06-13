import React, { useContext } from "react";
import { useRouter } from "next/router";

// INTERNAL IMPORT
import { ChatAppContext } from "../Context/ChatAppContext";
import { Welcome } from "../Components/index";

const Home = () => {
  const { connectWallet } = useContext(ChatAppContext);
  const router = useRouter();

  // Redirect manual setelah sukses menghubungkan wallet
  const handleStart = async () => {
    try {
      await connectWallet();
      router.push("/chat");
    } catch (e) {
      console.error("Gagal menghubungkan wallet:", e);
    }
  };

  return <Welcome connectWallet={handleStart} />;
};

export default Home;