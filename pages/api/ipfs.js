import fs from "fs";
import path from "path";

// Global in-memory cache to ensure mock IPFS works even on read-only environments
if (!global.mockIpfsCache) {
  global.mockIpfsCache = new Map();
}


// Batasi ukuran request body agar Next.js bisa memproses file/gambar profil hingga 50MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

// Helper untuk mendeteksi content-type dari byte awal (magic numbers) atau pola teks
function detectContentType(buffer) {
  if (!buffer || typeof buffer.length !== "number" || buffer.length < 1) {
    return "application/octet-stream";
  }
  if (buffer.length >= 4) {
    // Check PNG magic bytes: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
    // Check GIF magic bytes: 47 49 46 38 ("GIF8")
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return "image/gif";
    }
    // Check PDF magic bytes: 25 50 44 46 ("%PDF")
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
  }
  if (buffer.length >= 3) {
    // Check JPEG magic bytes: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
  }
  
  // Deteksi jika konten berupa JSON atau base64 Data URL (text/plain)
  try {
    const text = buffer.toString("utf8").trim();
    if (text.startsWith("{") || text.startsWith("[")) {
      return "application/json; charset=utf-8";
    }
    if (text.startsWith("data:")) {
      return "text/plain; charset=utf-8";
    }
  } catch (e) {}
  
  return "application/octet-stream";
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { cid } = req.query;
      if (!cid) {
        return res.status(400).json({ error: "Missing cid parameter" });
      }

      // Sanitasi CID — hanya izinkan alfanumerik, underscore, dan dash
      // untuk mencegah path traversal attack
      const safeCid = cid.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!safeCid || safeCid !== cid) {
        return res.status(400).json({ error: "Invalid CID format" });
      }

      // Tentukan direktori mock_ipfs di folder public
      const dir = path.join(process.cwd(), "public", "mock_ipfs");
      const filePath = path.join(dir, safeCid);
      const resolvedPath = path.resolve(filePath);

      // Pastikan path hasil resolve masih di dalam direktori yang aman
      if (!resolvedPath.startsWith(path.resolve(dir))) {
        return res.status(400).json({ error: "Invalid file path" });
      }

      // 1. Cek cache in-memory terlebih dahulu
      if (global.mockIpfsCache.has(safeCid)) {
        const content = global.mockIpfsCache.get(safeCid);
        let buffer;
        if (Buffer.isBuffer(content)) {
          buffer = content;
        } else if (typeof content === "string") {
          buffer = Buffer.from(content);
        } else if (content !== null && content !== undefined) {
          buffer = Buffer.from(JSON.stringify(content));
        } else {
          buffer = Buffer.alloc(0);
        }
        const contentType = detectContentType(buffer);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.status(200).send(buffer);
      }

      // 2. Cek cache lokal di disk server
      if (fs.existsSync(resolvedPath)) {
        try {
          const content = fs.readFileSync(resolvedPath);
          const contentType = detectContentType(content);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.status(200).send(content);
        } catch (readErr) {
          console.warn("Failed to read mock IPFS file from disk:", readErr);
        }
      }

      // Jika itu mock cid dan tidak ditemukan di server/in-memory, return 404
      if (cid.startsWith("mockcid_")) {
        return res.status(404).json({ error: "Mock CID not found on server" });
      }

      // 2. Fetch dari IPFS Gateway secara server-side jika tidak ada di cache lokal
      // CATATAN: Kami TIDAK menyertakan Authorization token ketika mengakses public IPFS gateways
      // karena token JWT Pinata hanya valid untuk API pinning (api.pinata.cloud), bukan untuk public gateway.
      const gateways = [
        `https://gateway.pinata.cloud/ipfs/${cid}`,
        `https://ipfs.io/ipfs/${cid}`,
        `https://cloudflare-ipfs.com/ipfs/${cid}`
      ];

      let lastError = null;
      for (const url of gateways) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const fetchRes = await fetch(url, { 
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (fetchRes.ok) {
            const contentType = fetchRes.headers.get("content-type") || "application/octet-stream";
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Simpan konten yang di-fetch ke cache in-memory dan disk server
            global.mockIpfsCache.set(safeCid, buffer);
            try {
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              fs.writeFileSync(resolvedPath, buffer);
            } catch (writeErr) {
              console.warn("Failed to write IPFS cache to disk:", writeErr);
            }

            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            return res.status(200).send(buffer);
          } else {
            lastError = `Status ${fetchRes.status} dari ${url}`;
          }
        } catch (fetchErr) {
          lastError = fetchErr.message || fetchErr;
        }
      }

      return res.status(502).json({ 
        error: `Gagal mengambil data dari IPFS gateway. Error terakhir: ${lastError}` 
      });
    } catch (error) {
      console.error("API IPFS fetch error:", error);
      return res.status(500).json({ error: error.message });
    }
  } else if (req.method === "POST") {
    try {
      const { cid, content } = req.body;
      if (!cid || !content) {
        return res.status(400).json({ error: "Missing cid or content" });
      }

      const safeCid = cid.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!safeCid || safeCid !== cid) {
        return res.status(400).json({ error: "Invalid CID format" });
      }

      // Simpan ke cache in-memory terlebih dahulu
      global.mockIpfsCache.set(safeCid, content);

      // Coba simpan ke disk server, tetapi jangan gagalkan request jika gagal karena masalah disk/permissions
      try {
        const dir = path.join(process.cwd(), "public", "mock_ipfs");
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, safeCid);
        const resolvedPath = path.resolve(filePath);
        if (resolvedPath.startsWith(path.resolve(dir))) {
          fs.writeFileSync(filePath, content, "utf8");
        }
      } catch (diskErr) {
        console.warn("Failed to write mock IPFS file to disk (falling back to memory-only):", diskErr);
      }

      return res.status(200).json({ success: true, cid: safeCid });
    } catch (error) {
      console.error("API IPFS upload error:", error);
      return res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
