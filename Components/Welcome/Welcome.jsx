import React, { useState, useContext, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import Style from "./Welcome.module.css";
import { ChatAppContext } from "../../Context/ChatAppContext";
import images from "../../assets";
import Error from "../Error/Error";
import { uploadToIPFS } from "../../Utils/ipfs";

const Welcome = () => {
  const { connectWallet, createAccount, error, setError, account } = useContext(ChatAppContext);
  const router = useRouter();

  const [view, setView] = useState("welcome"); // "welcome" | "register"
  const [connecting, setConnecting] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(""); // Holds IPFS CID of custom photo
  const [localWalletAddress, setLocalWalletAddress] = useState("");
  
  // Custom photo upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState("");

  // Update wallet address form value automatically if account changes
  useEffect(() => {
    if (account) {
      setLocalWalletAddress(account);
    }
  }, [account]);

  // Handle custom file upload to IPFS
  const handleCustomPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return setError("Berkas yang dipilih harus berupa gambar.");
    }

    try {
      setUploadingPhoto(true);
      setError("");
      
      const uploadRes = await uploadToIPFS(file);
      if (uploadRes && uploadRes.cid) {
        setSelectedAvatar(uploadRes.cid);
        setCustomPhotoUrl(uploadRes.gatewayUrl || `http://127.0.0.1:8080/ipfs/${uploadRes.cid}`);
      }
    } catch (err) {
      console.error("Custom photo upload failed:", err);
      setError(err.message || "Gagal mengunggah foto profil ke IPFS.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Clear custom photo
  const handleRemoveCustomPhoto = () => {
    setSelectedAvatar("");
    setCustomPhotoUrl("");
  };

  // Tombol 1: Connect Wallet & Login
  const handleConnectAndLogin = async () => {
    try {
      setConnecting(true);
      setError(""); // Clear previous errors
      const res = await connectWallet();

      if (res && res.account) {
        if (res.registered) {
          // Jika sudah terdaftar, langsung login & masuk ke chat
          router.push("/chat");
        } else {
          // Jika belum terdaftar, tampilkan pesan error & instruksi untuk daftar
          setLocalWalletAddress(res.account);
          setError("Alamat dompet MetaMask Anda belum terdaftar. Silakan klik tombol 'Create Account' untuk mendaftarkan akun baru.");
        }
      }
    } catch (e) {
      console.error("Login failed:", e);
      setError("Gagal menghubungkan dompet MetaMask");
    } finally {
      setConnecting(false);
    }
  };

  // Tombol 2: Create Account (Inisialisasi)
  const handleRegisterInit = async () => {
    try {
      setConnecting(true);
      setError(""); // Clear previous errors
      // Connect wallet first if not connected
      const res = await connectWallet();
      if (res && res.account) {
        setLocalWalletAddress(res.account);
        if (res.registered) {
          setError("Dompet Anda sudah terdaftar. Mengalihkan ke halaman chat...");
          router.push("/chat");
        } else {
          setView("register");
        }
      }
    } catch (e) {
      console.error("Register init failed:", e);
      setError("Gagal menghubungkan dompet MetaMask");
    } finally {
      setConnecting(false);
    }
  };

  // Submit Form Registrasi
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      return setError("Nama pengguna tidak boleh kosong");
    }
    if (!selectedAvatar) {
      return setError("Silakan unggah foto profil Anda terlebih dahulu.");
    }

    try {
      setRegistering(true);
      const success = await createAccount({
        name: username.trim(),
        avatarIndex: selectedAvatar
      });

      if (success) {
        // Otomatis arahkan ke halaman chat setelah registrasi berhasil
        router.push("/chat");
      }
    } catch (err) {
      console.error("Registration failed:", err);
      setError("Registrasi akun gagal. Coba lagi.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className={Style.welcome_container}>
      {error && <Error error={error} setError={setError} />}
      <div className={Style.welcome_box}>
        {view === "welcome" ? (
          <>
            <h1 className={Style.welcome_title}>Selamat Datang</h1>
            <p className={Style.welcome_description}>
              Platform Chat DApp Terdesentralisasi berbasis Blockchain.
              Kirim pesan instan dan berkas dengan aman menggunakan enkripsi End-to-End (E2EE).
            </p>
            <div className={Style.welcome_button_group}>
              <button
                className={Style.welcome_button}
                onClick={handleConnectAndLogin}
                disabled={connecting}
              >
                {connecting ? "Menghubungkan..." : (
                  <>
                    Connect Wallet <span className={Style.welcome_arrow}>&rarr;</span>
                  </>
                )}
              </button>

              <button
                className={Style.welcome_button_secondary}
                onClick={handleRegisterInit}
                disabled={connecting}
              >
                Create Account 👤
              </button>
            </div>
          </>
        ) : (
          <form className={Style.register_form} onSubmit={handleRegisterSubmit}>
            <h2 className={Style.welcome_title} style={{ fontSize: "2rem", alignSelf: "center", marginBottom: "0.5rem" }}>
              Registrasi Akun
            </h2>

            <div className={Style.info_alert}>
              Silakan lengkapi profil Anda untuk mendaftarkan akun di Blockchain.
            </div>

            {/* 1. Foto Profil (Paling Atas) */}
            <div className={Style.photo_upload_container}>
              <label className={Style.photo_upload_circle}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomPhotoUpload}
                  style={{ display: "none" }}
                  disabled={uploadingPhoto}
                />
                
                {uploadingPhoto ? (
                  <div className={Style.photo_upload_spinner_container}>
                    <div className={Style.photo_upload_spinner}></div>
                    <span className={Style.photo_upload_spinner_text}>Uploading...</span>
                  </div>
                ) : (
                  <>
                    {customPhotoUrl ? (
                      <img
                        src={customPhotoUrl}
                        alt="Profile Avatar"
                        className={Style.photo_upload_img}
                      />
                    ) : (
                      <svg viewBox="0 0 100 100" className={Style.photo_upload_img}>
                        <circle cx="50" cy="50" r="50" fill="#111111" />
                        <circle cx="50" cy="37" r="17" fill="#ffffff" />
                        <path d="M20 78 C20 60, 30 55, 50 55 C70 55, 80 60, 80 78 Z" fill="#ffffff" />
                      </svg>
                    )}
                    <div className={Style.photo_upload_overlay}>
                      <span className={Style.photo_upload_icon}>📷</span>
                      <span className={Style.photo_upload_text}>Upload</span>
                    </div>
                  </>
                )}
              </label>
              
              {customPhotoUrl ? (
                <button
                  type="button"
                  className={Style.photo_remove_btn}
                  onClick={handleRemoveCustomPhoto}
                  title="Hapus foto profil"
                >
                  &times; Hapus Foto
                </button>
              ) : (
                <span className={Style.photo_upload_hint}>Klik lingkaran untuk mengunggah foto profil (Wajib)</span>
              )}
            </div>

            {/* 2. Nama Pengguna (Urutan Kedua) */}
            <div className={Style.form_group}>
              <label className={Style.form_label}>Nama Pengguna (Username)</label>
              <input
                type="text"
                className={Style.form_input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan nama Anda..."
                maxLength={25}
                required
              />
            </div>

            {/* 3. Wallet Address (Paling Bawah) */}
            <div className={Style.form_group}>
              <label className={Style.form_label}>Wallet Address (Otomatis)</label>
              <input
                type="text"
                className={Style.form_input}
                value={localWalletAddress}
                disabled
                placeholder="MetaMask tidak terdeteksi"
              />
            </div>

            <div className={Style.form_buttons}>
              <button
                type="submit"
                className={Style.form_button_submit}
                disabled={registering || !username.trim() || uploadingPhoto || !selectedAvatar}
              >
                {registering ? "Mendaftarkan..." : "Daftar Sekarang"}
              </button>
              <button
                type="button"
                className={Style.form_button_cancel}
                onClick={() => setView("welcome")}
                disabled={registering}
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Welcome;
