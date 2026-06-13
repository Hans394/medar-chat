// Base64 helper utilities
export const encodeBase64 = (buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

export const decodeBase64 = (base64) => {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

// Import a raw 32-byte hex key as an AES-GCM CryptoKey
export const importAESKey = async (rawKeyHex) => {
  const cleanedHex = rawKeyHex.startsWith("0x") ? rawKeyHex.slice(2) : rawKeyHex;
  const bytes = new Uint8Array(
    cleanedHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );
  
  return await window.crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
};

// Encrypt plaintext using AES-GCM
export const encryptMessage = async (plaintext, rawKeyHex) => {
  try {
    const key = await importAESKey(rawKeyHex);
    const encoder = new TextEncoder();
    const encodedPlaintext = encoder.encode(plaintext);
    
    // Generate random 12-byte IV for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodedPlaintext
    );
    
    return {
      ciphertext: encodeBase64(ciphertext),
      iv: encodeBase64(iv),
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    throw error;
  }
};

// Decrypt base64-encoded ciphertext using AES-GCM
export const decryptMessage = async (base64Ciphertext, base64Iv, rawKeyHex) => {
  try {
    const key = await importAESKey(rawKeyHex);
    const decoder = new TextDecoder();
    
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64(base64Iv),
      },
      key,
      decodeBase64(base64Ciphertext)
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw error;
  }
};
