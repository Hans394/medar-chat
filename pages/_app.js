import "../styles/globals.css";
import dynamic from "next/dynamic";
import React, { useContext, useEffect } from "react";
import { useRouter } from "next/router";
import { NavBar, Loader } from "../Components/index";
import { ChatAppContext } from "../Context/ChatAppContext";

// Disable SSR for ChatAppProvider karena menggunakan window.ethereum
const ChatAppProvider = dynamic(
  () => import("../Context/ChatAppContext").then((mod) => mod.ChatAppProvider),
  { ssr: false }
);

function AppContent({ Component, pageProps }) {
  const { account, isInitialising } = useContext(ChatAppContext);
  const router = useRouter();

  // Guard routing global: jika wallet belum terhubung dan berada di halaman selain "/", redirect ke "/"
  useEffect(() => {
    if (isInitialising) return;
    if (!account && router.pathname !== "/") {
      router.push("/");
    }
  }, [account, isInitialising, router.pathname]);

  if (isInitialising && router.pathname !== "/") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <Loader />
      </div>
    );
  }

  // Mencegah flash content halaman privat jika tidak terhubung
  if (!isInitialising && !account && router.pathname !== "/") {
    return null;
  }

  return <Component {...pageProps} />;
}

export default function App({ Component, pageProps }) {
  return (
    <ChatAppProvider>
      <NavBar />
      <AppContent Component={Component} pageProps={pageProps} />
    </ChatAppProvider>
  );
}