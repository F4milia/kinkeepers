import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const nextConfig: NextConfig = {
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
};

export default withSentryConfig(nextConfig, {
  // Assumption: "brandlamb" matches the org used by the sibling Trib4l
  // project; "kinkeepers" is a guess at what this product's project slug
  // would be once someone actually creates it in the Sentry dashboard -
  // neither is confirmed. Source-map upload needs SENTRY_AUTH_TOKEN,
  // which doesn't exist either; withSentryConfig skips upload quietly
  // without one rather than failing the build (verified: build succeeds
  // with no SENTRY_* env vars set at all).
  org: "brandlamb",
  project: "kinkeepers",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
