exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const token = (event.headers.authorization || "").replace("Bearer ", "");
  if (token !== process.env.DASHBOARD_TOKEN) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const { recipients, message } = JSON.parse(event.body);
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  const credentials = Buffer.from(`${sid}:${authToken}`).toString("base64");

  const results = [];

  for (const to of recipients) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
        }
      );

      const data = await res.json();
      results.push({ to, success: res.ok, sid: data.sid, error: data.message });
    } catch (err) {
      results.push({ to, success: false, error: err.message });
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ results }),
  };
};
