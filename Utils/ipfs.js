// Helper to read File as Base64 Data URL (used for zero-config LocalStorage fallback)
const fileToDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Upload a JSON object to IPFS and return the CID.
 * Convenience wrapper around uploadToIPFS for structured data.
 */
export const uploadJSONToIPFS = async (jsonObject, fileName = "data.json") => {
  const blob = new Blob([JSON.stringify(jsonObject)], { type: "application/json" });
  const file = new File([blob], fileName, { type: "application/json" });
  const result = await uploadToIPFS(file);
  return result.cid;
};

/**
 * Upload a plain text string to IPFS and return the CID.
 * Used for storing encrypted message payloads.
 */
export const uploadTextToIPFS = async (text, fileName = "message.txt") => {
  const blob = new Blob([text], { type: "text/plain" });
  const file = new File([blob], fileName, { type: "text/plain" });
  const result = await uploadToIPFS(file);
  return result.cid;
};

/**
 * Fetch and parse a JSON object from IPFS by CID.
 */
export const fetchJSONFromIPFS = async (cid) => {
  const text = await fetchFromIPFS(cid);
  return JSON.parse(text);
};

/**
 * IPFS upload utility.
 * Supports:
 * 1. Pinata IPFS (if NEXT_PUBLIC_PINATA_JWT environment variable is set)
 * 2. Local IPFS Daemon (fallback to Kubo IPFS running on http://127.0.0.1:5001)
 * 3. Local Browser Caching (Mock IPFS for zero-config local testing and skripsi demo)
 */
export const uploadToIPFS = async (file) => {
  const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (pinataJwt && pinataJwt !== "YOUR_PINATA_JWT") {
    // Upload to Pinata IPFS
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Include Pinata metadata to help organize files
      const pinataMetadata = JSON.stringify({
        name: file.name,
      });
      formData.append("pinataMetadata", pinataMetadata);

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Pinata upload failed with status ${res.status}`);
      }

      const data = await res.json();
      return {
        cid: data.IpfsHash,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
        fileName: file.name,
        fileType: file.type,
      };
    } catch (error) {
      console.error("Pinata IPFS upload failed:", error);
      throw error;
    }
  } else {
    // Fallback: Local IPFS Daemon (Kubo / Go-IPFS)
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Call the local IPFS api endpoint
      const res = await fetch("http://127.0.0.1:5001/api/v0/add", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Local IPFS daemon upload failed with status ${res.status}`);
      }

      const data = await res.json();
      return {
        cid: data.Hash,
        gatewayUrl: `https://ipfs.io/ipfs/${data.Hash}`, // Public gateway link
        fileName: file.name,
        fileType: file.type,
      };
    } catch (error) {
      console.warn("Local IPFS daemon offline, falling back to LocalStorage Mock IPFS upload...", error);

      // Fallback 3: Local Browser Caching (Mock IPFS for zero-config demo/skripsi)
      try {
        // Batasi ukuran file 1MB untuk mock IPFS — file lebih besar menyebabkan
        // konversi base64 memblokir main thread sehingga MetaMask popup tidak muncul
        const MAX_MOCK_SIZE = 1 * 1024 * 1024; // 1MB
        if (file.size > MAX_MOCK_SIZE) {
          throw new Error(
            `Ukuran file maksimal 1MB untuk mode demo (Mock IPFS). File kamu: ${(file.size / 1024 / 1024).toFixed(1)}MB.\n\nIsi NEXT_PUBLIC_PINATA_JWT di file .env.local untuk upload hingga 25MB (gratis di pinata.cloud).`
          );
        }

        const dataUrl = await fileToDataURL(file);
        const mockCid = `mockcid_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;

        // Simpan ke localStorage di luar microtask queue agar tidak blokir main thread
        if (typeof window !== "undefined") {
          setTimeout(() => {
            try {
              localStorage.setItem(`mock_ipfs_${mockCid}`, dataUrl);
            } catch (storageErr) {
              console.warn("Failed to cache uploaded file in localStorage:", storageErr);
            }
          }, 0);
        }

        // Sync ke backend server di background — tidak perlu await agar tidak blokir
        fetch("/api/ipfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cid: mockCid, content: dataUrl }),
        }).catch((apiErr) => {
          console.warn("Failed to sync mock IPFS to backend server:", apiErr);
        });

        return {
          cid: mockCid,
          gatewayUrl: dataUrl,
          fileName: file.name,
          fileType: file.type,
        };
      } catch (mockErr) {
        console.error("Mock IPFS upload failed:", mockErr);
        throw new Error(mockErr.message || "Failed to process local file upload.");
      }
    }
  }
};

/**
 * Fetches text content from IPFS.
 * Supports both Mock CID (localStorage) and standard IPFS gateway CIDs.
 */
export const fetchFromIPFS = async (cid) => {
  if (!cid) return "";

  // 1. In-memory cache to completely eliminate redundant network requests in the same session
  if (typeof window !== "undefined") {
    if (!window.__ipfs_cache__) {
      window.__ipfs_cache__ = {};
    }
    if (window.__ipfs_cache__[cid] !== undefined) {
      return window.__ipfs_cache__[cid];
    }
  }

  // 2. Client-side LocalStorage fallback check for mock CIDs
  if (cid.startsWith("mockcid_") && typeof window !== "undefined") {
    const localData = localStorage.getItem(`mock_ipfs_${cid}`);
    if (localData) {
      // Sync to backend server in background to ensure persistence
      fetch("/api/ipfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, content: localData }),
      }).catch(() => {});

      let resolvedContent = localData;
      if (localData.startsWith("data:")) {
        try {
          const res = await fetch(localData);
          resolvedContent = await res.text();
        } catch (e) {
          console.warn("Failed to parse data URL for mock CID:", e);
        }
      }
      
      window.__ipfs_cache__[cid] = resolvedContent;
      return resolvedContent;
    }
  }

  // 3. Fetch from our server-side API proxy/cache
  try {
    const res = await fetch(`/api/ipfs?cid=${encodeURIComponent(cid)}`);
    if (!res.ok) {
      throw new Error(`Proxy error: status ${res.status}`);
    }
    
    let content = await res.text();

    // Data URL handling (for mock CIDs that might be synced as data URLs)
    if (content.startsWith("data:")) {
      try {
        const resUrl = await fetch(content);
        content = await resUrl.text();
      } catch (e) {
        console.warn("Failed to parse data URL from server response:", e);
      }
    }

    // Cache in memory and localStorage (if mock CID)
    if (typeof window !== "undefined") {
      window.__ipfs_cache__[cid] = content;
      if (cid.startsWith("mockcid_")) {
        try {
          localStorage.setItem(`mock_ipfs_${cid}`, content);
        } catch (e) {}
      }
    }
    return content;
  } catch (error) {
    console.warn(`Server-side proxy fetch failed for CID ${cid}, trying fallback...`, error);

    // Fallback: If server proxy fails, try direct fetch from public gateways in client as absolute last resort
    try {
      const fallbackUrl = cid.startsWith("mockcid_")
        ? `/mock_ipfs/${cid}`
        : `https://ipfs.io/ipfs/${cid}`;
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        let content = await res.text();
        if (content.startsWith("data:")) {
          const resUrl = await fetch(content);
          content = await resUrl.text();
        }
        if (typeof window !== "undefined") {
          window.__ipfs_cache__[cid] = content;
        }
        return content;
      }
    } catch (fallbackErr) {
      console.error("Client fallback fetch also failed:", fallbackErr);
    }
    
    throw error;
  }
};