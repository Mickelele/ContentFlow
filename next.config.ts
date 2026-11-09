import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Pomocnik czyta przewodnik i dziennik zmian z dysku — dołącz je do funkcji na Vercelu.
  outputFileTracingIncludes: {
    "/api/pomocnik": ["./docs/PRZEWODNIK.md", "./CHANGELOG.md"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
