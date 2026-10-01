// Vercel serverless function: the tablet posts here (same origin, no CORS),
// and this forwards the entry to the Google Apps Script web app.
// The values below are built in. Vercel environment variables with the same
// names (GOOGLE_SCRIPT_URL, SHARED_KEY) override them if set.
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBgH0FrGoWEHhifWwBB4VNfzwoEIlVJfn1mhGh9pSMPzDrliWYscy_erg1M8R9EesK5A/exec';
const DEFAULT_KEY = 'gsc-g09-2026';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.GOOGLE_SCRIPT_URL || DEFAULT_SCRIPT_URL;
  const key = process.env.SHARED_KEY || DEFAULT_KEY;

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
    body.key = key;

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
