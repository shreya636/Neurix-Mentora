/** Adapt a Netlify Function handler to Vercel's Node.js request/response API. */
export function adaptNetlifyHandler(handler) {
  return async function vercelHandler(req, res) {
    const headers = Object.fromEntries(
      Object.entries(req.headers || {}).map(([name, value]) => [
        name.toLowerCase(), Array.isArray(value) ? value.join(",") : value
      ])
    );
    const queryStringParameters = Object.fromEntries(
      new URL(req.url || "/", "http://localhost").searchParams.entries()
    );
    const event = {
      httpMethod: req.method || "GET",
      headers,
      queryStringParameters,
      body: req.body == null
        ? null
        : typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      isBase64Encoded: false
    };

    try {
      const result = await handler(event, {});
      const statusCode = Number(result?.statusCode) || 200;
      for (const [name, value] of Object.entries(result?.headers || {})) {
        res.setHeader(name, value);
      }
      if (result?.isBase64Encoded) {
        res.status(statusCode).send(Buffer.from(result.body || "", "base64"));
      } else {
        res.status(statusCode).send(result?.body ?? "");
      }
    } catch (error) {
      console.error("Vercel function adapter failed:", error);
      res.status(500).json({ error: "The server could not complete this request." });
    }
  };
}
