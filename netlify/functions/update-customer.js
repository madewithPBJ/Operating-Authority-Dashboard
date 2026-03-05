exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "PUT") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const token = (event.headers.authorization || "").replace("Bearer ", "");
  if (token !== process.env.DASHBOARD_TOKEN) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const { id, name, phone } = JSON.parse(event.body);

  if (!name || !name.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Name is required" }) };
  }
  if (!phone || !phone.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Phone is required" }) };
  }

  let normalizedPhone = phone.replace(/[\s\-()]/g, "");
  if (!normalizedPhone.startsWith("whatsapp:")) {
    if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+1" + normalizedPhone;
    }
    normalizedPhone = "whatsapp:" + normalizedPhone;
  }

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/customers?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name, phone: normalizedPhone }),
    }
  );

  const data = await res.json();
  return { statusCode: res.status, headers, body: JSON.stringify(data) };
};
