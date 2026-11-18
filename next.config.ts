import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: {
    rules: {
      "*": {
        condition: { path: /(?:^|\/)src\/institutional\/assets\/.*\.(?:png|svg)$/ },
        type: "asset",
      },
    },
  },
};

export default config;
