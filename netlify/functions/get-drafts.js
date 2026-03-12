exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };

  const token = (event.headers.authorization || "").replace("Bearer ", "");
  if (token !== process.env.DASHBOARD_TOKEN) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const params = event.queryStringParameters || {};

  let url = `${process.env.SUPABASE_URL}/rest/v1/drafts?select=*&order=sent_at.desc`;

  if (params.phone) {
    url += `&customer_phone=eq.${encodeURIComponent(params.phone)}`;
  }

  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
    },
  });

  const data = await res.json();
  return { statusCode: res.status, headers, body: JSON.stringify(data) };
};
