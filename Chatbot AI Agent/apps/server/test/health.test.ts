import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { healthRouter } from "../src/http/routes/health.js";

async function withApp(run: (base: string) => Promise<void>) {
  const app = express();
  app.use(healthRouter);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await run(base);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe("health routes", () => {
  it("public /health does not expose AI provider", async () => {
    await withApp(async (base) => {
      const res = await fetch(`${base}/health`);
      const json = await res.json();
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal("aiProvider" in json, false);
      assert.equal("aiConfigured" in json, false);
      assert.equal("commerceProvider" in json, false);
    });
  });

  it("diagnostics require token", async () => {
    const prev = process.env.HEALTH_DIAGNOSTICS_TOKEN;
    process.env.HEALTH_DIAGNOSTICS_TOKEN = "test-diag-token";
    try {
      await withApp(async (base) => {
        const denied = await fetch(`${base}/health/diagnostics`);
        assert.equal(denied.status, 401);

        const ok = await fetch(`${base}/health/diagnostics`, {
          headers: { "x-health-token": "test-diag-token" },
        });
        const json = await ok.json();
        assert.equal(ok.status, 200);
        assert.equal(json.ok, true);
        assert.ok(typeof json.aiProvider === "string");
        assert.equal(typeof json.aiConfigured, "boolean");
      });
    } finally {
      if (prev == null) delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
      else process.env.HEALTH_DIAGNOSTICS_TOKEN = prev;
    }
  });
});
