import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.stockyai.app",
  appName: "Stocky",
  webDir: "out",
  server: {
    url: "https://master.d1goia2b8u8wzg.amplifyapp.com/",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0f172a",
  },
};

export default config;
