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
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 4000,
      launchFadeOutDuration: 350,
      backgroundColor: "#fbfaf5",
      androidSplashResourceName: "ayu_scholar_mark",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: true,
      androidSpinnerStyle: "small",
      spinnerColor: "#007f69",
    },
  },
};

export default config;
