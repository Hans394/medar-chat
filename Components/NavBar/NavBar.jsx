import React, { useState, useContext, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Style from "./NavBar.module.css";
import { ChatAppContext } from "../../Context/ChatAppContext";
import { Error } from "../../Components/index";
import images from "../../assets";

const NavBar = () => {
  const menuItems = [
    { menu: "All Users", link: "alluser" },
    { menu: "CHAT", link: "chat" },
    { menu: "CONTACT", link: "contact" },
    { menu: "SETTING", link: "setting" },
  ];

  const router = useRouter();

  const getActiveIndexFromPath = (pathname) => {
    const pathMap = {
      "/alluser": 1,
      "/chat": 2,
      "/contact": 3,
      "/setting": 4,
    };
    return pathMap[pathname] || 2;
  };

  const [active, setActive] = useState(() => getActiveIndexFromPath(router.pathname));
  const [openNotif, setOpenNotif] = useState(false);
  const [openMobileMenu, setOpenMobileMenu] = useState(false);

  // Sinkronkan state active saat URL berubah (navigasi langsung, tombol back/forward)
  useEffect(() => {
    setActive(getActiveIndexFromPath(router.pathname));
  }, [router.pathname]);

  const {
    account,
    userName,
    userAvatar,
    error,
    setError,
    notifications,
    unreadCount,
    markNotificationRead,
    clearNotifications,
    setActiveChatAddress,
    readMessage,
    isInitialising,
  } = useContext(ChatAppContext);

  // Redirect ke halaman Selamat Datang jika wallet belum terhubung
  useEffect(() => {
    if (isInitialising) return;
    if (account === "" && router.pathname !== "/") {
      router.push("/");
    }
  }, [account, router.pathname, isInitialising]);

  const handleNotifClick = async (notif) => {
    markNotificationRead(notif.id);
    setOpenNotif(false);

    if (notif.type === "message_received" && notif.address) {
      setActive(2);
      if (router.pathname !== "/chat") {
        await router.push("/chat");
      }
      setActiveChatAddress(notif.address);
      await readMessage(notif.address);
    }
  };

  const notifRef = useRef(null);

  // Close notification popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setOpenNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeAgo = (date) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
    return `${Math.floor(diff / 86400)}h lalu`;
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case "message_received": return "💬";
      case "friend_added": return "👤";
      case "account_created": return "🎉";
      default: return "🔔";
    }
  };

  const avatarImages = [images.image1, images.image2, images.image3, images.image4, images.image5, images.image6, images.image7, images.image8, images.image9, images.image10];

  const defaultAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23111111"/><circle cx="50" cy="37" r="17" fill="%23ffffff"/><path d="M20 78 C20 60, 30 55, 50 55 C70 55, 80 60, 80 78 Z" fill="%23ffffff"/></svg>`;

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

  const profileImg = getAvatarUrl(userAvatar);

  // Sembunyikan NavBar ketika di halaman Selamat Datang (wallet belum terhubung)
  if (isInitialising || account === "") {
    return null;
  }

  return (
    <div className={Style.NavBar}>
      <div className={Style.NavBar_box}>
        <div className={Style.NavBar_box_left}>
          <Image src={images.logo} alt="logo" width={50} height={50} />
        </div>

        {/* HAMBURGER TOGGLE BUTTON FOR MOBILE */}
        <button
          className={Style.NavBar_hamburger}
          onClick={() => setOpenMobileMenu(!openMobileMenu)}
          aria-label="Toggle menu"
        >
          <span className={`${Style.hamburger_line} ${openMobileMenu ? Style.line_open : ""}`}></span>
          <span className={`${Style.hamburger_line} ${openMobileMenu ? Style.line_open : ""}`}></span>
          <span className={`${Style.hamburger_line} ${openMobileMenu ? Style.line_open : ""}`}></span>
        </button>

        {/* DESKTOP MENU */}
        <div className={Style.NavBar_box_right}>
          <div className={Style.NavBar_box_right_menu}>
            {menuItems.map((el, i) => (
              <div
                onClick={() => setActive(i + 1)}
                key={i + 1}
                className={`${Style.NavBar_box_right_menu_items} ${active === i + 1 ? Style.active_btn : ""}`}
              >
                <Link className={Style.NavBar_box_right_menu_items_link} href={el.link}>
                  {el.menu}
                </Link>
              </div>
            ))}
          </div>

          {/* NOTIFICATION BELL */}
          <div className={Style.NavBar_notif_wrapper} ref={notifRef}>
            <button
              className={Style.NavBar_notif_bell}
              onClick={() => setOpenNotif(!openNotif)}
              aria-label="Notifications"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className={Style.NavBar_notif_badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {/* NOTIFICATION POPUP */}
            {openNotif && (
              <div className={Style.NavBar_notif_popup}>
                <div className={Style.NavBar_notif_header}>
                  <h4>Notifikasi</h4>
                  {notifications.length > 0 && (
                    <button className={Style.NavBar_notif_clear} onClick={() => clearNotifications()}>
                      Hapus Semua
                    </button>
                  )}
                </div>
                <div className={Style.NavBar_notif_list}>
                  {notifications.length === 0 ? (
                    <div className={Style.NavBar_notif_empty}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <p>Belum ada notifikasi</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`${Style.NavBar_notif_item} ${!notif.read ? Style.NavBar_notif_unread : ""}`}
                        onClick={() => handleNotifClick(notif)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className={Style.NavBar_notif_icon}>
                          {getNotifIcon(notif.type)}
                        </div>
                        <div className={Style.NavBar_notif_content}>
                          <span className={Style.NavBar_notif_title}>{notif.title}</span>
                          <span className={Style.NavBar_notif_text}>{notif.text}</span>
                          {notif.detail && (
                            <span className={Style.NavBar_notif_detail}>"{notif.detail}"</span>
                          )}
                        </div>
                        <span className={Style.NavBar_notif_time}>{timeAgo(notif.time)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* PROFILE BUTTON */}
          {userName && (
            <div className={Style.NavBar_box_right_connect}>
              <button onClick={() => router.push({ pathname: "/setting", query: { section: "profile" } })}>
                <Image
                  src={profileImg}
                  alt="Account"
                  width={30}
                  height={30}
                  className={Style.NavBar_profile_img}
                  unoptimized
                />
                <small>{userName}</small>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE DROPDOWN MENU */}
      {openMobileMenu && (
        <div className={Style.NavBar_mobile_dropdown}>
          <div className={Style.NavBar_mobile_menu}>
            {menuItems.map((el, i) => (
              <div
                onClick={() => {
                  setActive(i + 1);
                  setOpenMobileMenu(false);
                }}
                key={i + 1}
                className={`${Style.NavBar_mobile_menu_items} ${active === i + 1 ? Style.active_mobile_btn : ""}`}
              >
                <Link className={Style.NavBar_box_right_menu_items_link} href={el.link}>
                  {el.menu}
                </Link>
              </div>
            ))}
          </div>

          {/* MOBILE NOTIFICATION ROW */}
          <div
            className={Style.NavBar_mobile_notif_row}
            onClick={() => { setOpenNotif(!openNotif); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notifikasi</span>
            {unreadCount > 0 && (
              <span className={Style.NavBar_notif_badge_mobile}>{unreadCount}</span>
            )}
          </div>

          {/* MOBILE PROFILE BUTTON */}
          {userName && (
            <div className={Style.NavBar_mobile_connect}>
              <button onClick={() => { router.push({ pathname: "/setting", query: { section: "profile" } }); setOpenMobileMenu(false); }}>
                <Image
                  src={profileImg}
                  alt="Account"
                  width={30}
                  height={30}
                  className={Style.NavBar_profile_img}
                  unoptimized
                />
                <small>{userName}</small>
              </button>
            </div>
          )}
        </div>
      )}

      {error !== "" && <Error error={error} setError={setError} />}
    </div>
  );
};

export default NavBar;