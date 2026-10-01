// Vercel serverless function: the tablet posts here (same origin, no CORS),
// and this forwards the entry to the Google Apps Script web app.
// Set these in Vercel → Project → Settings → Environment Variables:
//   GOOGLE_SCRIPT_URL  the Apps Script web app URL (ends with /exec)
//   SHARED_KEY         the same value as SHARED_KEY in the Apps Script

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) return res.status(200).json({ ok: false, error: 'GOOGLE_SCRIPT_URL is not set on Vercel' });

  try {
    if (req.method === 'GET') {
      const r = await fetch(url, { redirect: 'follow' });
      return res.status(200).json(await r.json());
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    let body = req.body;
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') body = body ? JSON.parse(body) : {};
    body = body || {};
    if (process.env.SHARED_KEY) body.key = process.env.SHARED_KEY;

    // Apps Script answers POST with a 302 to script.googleusercontent.com; fetch follows it.
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    });
    const text = await r.text();
    let j;
    try { j = JSON.parse(text); }
    catch (e) { return res.status(200).json({ ok: false, error: 'Google did not return JSON (check the script is deployed with access "Anyone")' }); }
    return res.status(200).json(j);
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err && err.message || err) });
  }
};
