import { createSkyeErrorsClient } from "../sdk/skye-errors-sdk.mjs";

export default {
  async fetch(request, env, ctx) {
    const skye = createSkyeErrorsClient({
      endpoint: env.KAIXU_BRAIN_URL,
      token: env.KAIXU_APP_TOKEN,
      app: "customer-worker",
      release: env.RELEASE || "dev",
      environment: env.ENVIRONMENT || "dev",
      scrubUrlQuery: true,
      tags: { tenant: "example" },
    });

    const handler = skye.withSkyeErrors(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/boom") {
        throw new Error("Boom. This is a test error for SkyeErrors.");
      }
      return new Response("OK. Try /boom to throw an error.");
    });

    return handler(request, env, ctx);
  }
};
