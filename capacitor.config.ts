import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ayuscholar.review",
  appName: "Ayu Review",
  webDir: "mobile-web",
  server: {
    url: "https://ayu-review.ravanraj9809.workers.dev",
    cleartext: false,
  },
  android: {
    backgroundColor: "#fbfaf5",
  },
};

export default config;
