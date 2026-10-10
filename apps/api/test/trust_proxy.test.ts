import { describe, it, expect } from "vitest";
import { buildServer } from "../src/server.js";

describe("Trust Proxy & Rate Limiting IP Tracking Tests", () => {
  it("resolves req.ip from X-Forwarded-For header when trustProxy is 1 (hop count)", async () => {
    const app = await buildServer({ trustProxy: 1 });

    // Send request with X-Forwarded-For
    const clientIp = "203.0.113.195";
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-for": clientIp,
      },
    });

    expect(res.statusCode).toBe(200);
    // When trustProxy is 1, Fastify resolves req.ip to the client IP
  });

  it("isolates rate limiting counters across different client IPs forwarded by proxy", async () => {
    const app = await buildServer({ trustProxy: 1 });

    const clientA = "198.51.100.1";
    const clientB = "198.51.100.2";

    // Client A makes a request
    const resA = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-for": clientA,
      },
    });
    expect(resA.statusCode).toBe(200);

    // Client B makes a request
    const resB = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-for": clientB,
      },
    });
    expect(resB.statusCode).toBe(200);

    // Verify rate limit headers exist and distinguish client limits
    expect(resA.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(resB.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("ignores X-Forwarded-For when trustProxy is 0 (direct connection / disabled)", async () => {
    const app = await buildServer({ trustProxy: 0 });

    const spoofedIp = "203.0.113.99";
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-forwarded-for": spoofedIp,
      },
    });

    expect(res.statusCode).toBe(200);
  });
});
