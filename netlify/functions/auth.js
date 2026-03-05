exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { password } = JSON.parse(event.body);

    if (password === process.env.DASHBOARD_PASSWORD) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ token: process.env.DASHBOARD_TOKEN }),
      };
    }

    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Wrong password" }),
    };
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid request" }),
    };
  }
};
