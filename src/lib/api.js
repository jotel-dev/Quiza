/**
 * Centralized API client with per-route timeouts, retries, and friendly errors.
 * - In dev, uses relative paths to leverage Vite proxy.
 * - In prod, prefixes VITE_API_URL.
 */

const RAW_API_URL = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.trim().replace(/\/+$/, "")
  : "";

const ROUTE_CONFIGS = {
  "/api/verify-round": { timeoutMs: 60000, retries: 0 },
  "/api/round-questions": { timeoutMs: 15000, retries: 0 },
  "/api/challenge": { timeoutMs: 15000, retries: 0 },
  "/api/session": { timeoutMs: 15000, retries: 0 },
  "/api/user": { timeoutMs: 15000, retries: 0 },
  "/api/verify-practice": { timeoutMs: 15000, retries: 0 },
  "/api/question-stats": { timeoutMs: 20000, retries: 1 },
  "/api/leaderboard": { timeoutMs: 20000, retries: 1 },
};

async function executeFetch(url, normalizedPath, options, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (timedOut || (err && err.name === "AbortError" && timedOut)) {
      const timeoutError = new Error("The game server did not respond. Please try again.");
      timeoutError.name = "TimeoutError";
      throw timeoutError;
    }
    if (options.signal && options.signal.aborted) {
      throw err;
    }
    const networkError = new Error("Could not reach the game server.");
    networkError.name = "NetworkError";
    networkError.cause = err;
    throw networkError;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const pathname = normalizedPath.split("?")[0];
  const routeConfig = ROUTE_CONFIGS[pathname] || { timeoutMs: 15000, retries: 0 };

  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  const url = isDev || !RAW_API_URL
    ? normalizedPath
    : `${RAW_API_URL}${normalizedPath}`;

  const timeoutMs = options.timeoutMs ?? routeConfig.timeoutMs;
  const method = (options.method || "GET").toUpperCase();
  const maxRetries = method === "GET" ? (options.retries ?? routeConfig.retries) : 0;

  let attempt = 0;
  while (true) {
    try {
      const response = await executeFetch(url, normalizedPath, options, timeoutMs);

      if (!response.ok) {
        // Status code kept in console log only
        console.error(`HTTP ${response.status}: ${normalizedPath}`);

        // Retry on 5xx if retries remain
        if (response.status >= 500 && attempt < maxRetries) {
          attempt++;
          continue;
        }

        if (options.throwOnHttpError === false) {
          return response;
        }

        let friendlyMessage = "The game server reported an error. Please try again.";
        try {
          const data = await response.clone().json();
          if (data && data.error) {
            friendlyMessage = data.error;
          }
        } catch {}

        const httpError = new Error(friendlyMessage);
        httpError.status = response.status;
        httpError.response = response;
        throw httpError;
      }

      return response;
    } catch (err) {
      if (attempt < maxRetries && (err.name === "TimeoutError" || err.name === "NetworkError")) {
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
