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

  const { customer_phone, customer_name, draft_text } = JSON.parse(event.body);

  if (!customer_phone) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No customer selected" }) };
  }
  if (!draft_text || !draft_text.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No draft text" }) };
  }
  if (!customer_name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No customer name" }) };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  const contentSid = process.env.TWILIO_DRAFT_CONTENT_SID;

  if (!sid || !authToken || !from) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured: missing Twilio credentials" }) };
  }
  if (!contentSid) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured: missing TWILIO_DRAFT_CONTENT_SID" }) };
  }

  const credentials = Buffer.from(`${sid}:${authToken}`).toString("base64");
  const supabaseHeaders = {
    apikey: process.env.SUPABASE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  try {
    // 1. Store draft in Supabase first to get UUID
    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/drafts`, {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify({
        customer_phone,
        draft_text: draft_text.trim(),
        status: "pending",
      }),
    });

    const insertData = await insertRes.json();
    if (!insertRes.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to store draft" }) };
    }

    const draftId = Array.isArray(insertData) ? insertData[0].id : insertData.id;

    // 2. Build link to full draft (no inline text — avoids newline/char limit issues)
    const siteUrl = process.env.URL || "https://operating-authority-dashboard.netlify.app";
    const fullDraftUrl = `${siteUrl}/.netlify/functions/view-draft?id=${draftId}`;

    // 3. Send WhatsApp template via Twilio Content API
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: from,
          To: customer_phone,
          ContentSid: contentSid,
          ContentVariables: JSON.stringify({ "1": customer_name, "2": fullDraftUrl }),
        }).toString(),
      }
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      // Clean up the draft since send failed
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/drafts?id=eq.${draftId}`, {
        method: "DELETE",
        headers: supabaseHeaders,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: false, error: twilioData.message || twilioData.error_message || "Twilio error" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageSid: twilioData.sid,
        draftId,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
