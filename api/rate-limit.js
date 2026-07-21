const rateLimitMap = new Map();

export function rateLimit(req, res, maxRequests = 10, windowMs = 60000) {
  // Extract IP from standard Vercel headers, or fallback to socket address
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  // Lazy cleanup to avoid setInterval keeping the serverless instance alive
  if (Math.random() < 0.05) { // 5% chance on each request to clean up
    for (const [key, data] of rateLimitMap.entries()) {
      if (now - data.startTime > windowMs) {
        rateLimitMap.delete(key);
      }
    }
  }

  const requestData = rateLimitMap.get(ip) || { count: 0, startTime: now };

  if (now - requestData.startTime > windowMs) {
    requestData.count = 1;
    requestData.startTime = now;
  } else {
    requestData.count++;
  }

  rateLimitMap.set(ip, requestData);

  if (requestData.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
    return false; // Rate limit exceeded
  }

  return true; // Allowed
}
