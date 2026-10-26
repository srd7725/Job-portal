const requests = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const aiRateLimit = (req, res, next) => {
    const now = Date.now();
    const userId = req.id;
    const recent = (requests.get(userId) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS) {
        return res.status(429).json({
            message: "Too many AI requests. Please wait a minute and try again.",
            success: false
        });
    }
    recent.push(now);
    requests.set(userId, recent);
    next();
};

export default aiRateLimit;
