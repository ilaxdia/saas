export default function handler(req, res) {
    const hasKey = !!process.env.GEMINI_API_KEY;
    return res.status(200).json({ configured: hasKey });
}
