exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "DELETE") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const token = (event.headers.authorization || "").replace("Bearer ", "");
  if (token !== process.env.DASHBOARD_TOKEN) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const { id } = JSON.parse(event.body);

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/customers?id=eq.${id}`,
    {
      method: "DELETE",
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      },
    }
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true }),
  };
};
