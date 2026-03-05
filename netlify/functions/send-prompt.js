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

  const { recipients, questions, message } = JSON.parse(event.body);

  if (!recipients || !recipients.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No recipients" }) };
  }
  if (!questions || !questions.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No questions" }) };
  }
  if (!message || !message.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No message" }) };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!sid || !authToken || !from) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured: missing Twilio credentials" }) };
  }

  const credentials = Buffer.from(`${sid}:${authToken}`).toString("base64");
  const results = [];

  for (const to of recipients) {
    try {
      // 1. Send WhatsApp message via Twilio
      const twilioRes = await fetch(
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

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok) {
        results.push({ to, success: false, error: twilioData.error_message });
        continue;
      }

      // 2. Store prompt in Supabase
      const promptRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/prompts`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          customer_phone: to,
          questions: questions,
          message_sent: message,
        }),
      });

      const promptData = await promptRes.json();
      results.push({
        to,
        success: true,
        messageSid: twilioData.sid,
        promptId: Array.isArray(promptData) ? promptData[0]?.id : promptData.id,
      });
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
