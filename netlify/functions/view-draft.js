exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const id = params.id;

  const htmlHeaders = {
    "Content-Type": "text/html; charset=utf-8",
  };

  if (!id) {
    return { statusCode: 400, headers: htmlHeaders, body: "<h1>Missing draft ID</h1>" };
  }

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/drafts?id=eq.${encodeURIComponent(id)}&select=draft_text,customer_phone,sent_at`,
    {
      headers: {
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      },
    }
  );

  const data = await res.json();

  if (!data || data.length === 0) {
    return { statusCode: 404, headers: htmlHeaders, body: "<h1>Draft not found</h1>" };
  }

  const draft = data[0];
  const date = new Date(draft.sent_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Escape HTML entities
  const escaped = draft.draft_text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Draft for Review — Operating Authority</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, -apple-system, sans-serif;
      background: #111a24;
      color: #e0e0e0;
      padding: 2rem;
      line-height: 1.7;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
    }
    h1 {
      font-family: 'Stack Sans Headline', Inter, sans-serif;
      color: #c8a868;
      font-size: 1.4rem;
      margin-bottom: 0.5rem;
    }
    .date {
      color: #888;
      font-size: 0.85rem;
      margin-bottom: 2rem;
    }
    .draft-text {
      background: #1a2533;
      border-radius: 4px;
      padding: 1.5rem;
      font-size: 1rem;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Your Draft for Review</h1>
    <div class="date">${date}</div>
    <div class="draft-text">${escaped}</div>
  </div>
</body>
</html>`;

  return { statusCode: 200, headers: htmlHeaders, body: html };
};
