export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      const email = body.email?.trim();
      const name = body.name?.trim() || "Anonymous";

      console.log("📨 New Submission →", { name, email });

      if (!email) {
        return new Response("Missing email", {
          status: 400,
          headers: corsHeaders
        });
      }

      const jwt = await generateJWT(env);
      const sheetId = env.SHEET_ID;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [[name, email, new Date().toISOString()]]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.log("❌ Google Sheets error:", error);
        return new Response(`Failed to write to sheet: ${error}`, {
          status: 500,
          headers: corsHeaders
        });
      }

      return new Response("✅ Name + email added to sheet!", {
        status: 200,
        headers: corsHeaders
      });

    } catch (err) {
      console.log("🔥 Internal error:", err);
      return new Response(`Internal error: ${err.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

async function generateJWT(env) {
  const header = { alg: "RS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = {
    iss: env.CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp
  };

  const encode = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const toSign = `${encode(header)}.${encode(payload)}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    str2ab(env.PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${toSign}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get access token");
  return data.access_token;
}

// ✅ FIXED BASE64 CLEANER
function str2ab(pem) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\r?\n|\r/g, "")
    .trim();

  // Proper padding for base64 string
  const padLength = 4 - (cleaned.length % 4);
  const padded = cleaned + "=".repeat(padLength === 4 ? 0 : padLength);

  const binary = atob(padded);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}
