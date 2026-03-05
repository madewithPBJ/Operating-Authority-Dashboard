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

  const { transcription_id, prompt_id, question_index } = JSON.parse(event.body);

  if (!transcription_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "transcription_id is required" }) };
  }

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/transcriptions?id=eq.${transcription_id}`,
    {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        prompt_id: prompt_id || null,
        question_index: question_index != null ? question_index : null,
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    return { statusCode: res.status, headers, body: JSON.stringify({ error }) };
  }

  const data = await res.json();
  return { statusCode: 200, headers, body: JSON.stringify(data) };
};
