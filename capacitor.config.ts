import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // ─── Identity ───────────────────────────────────────────────────────────────
  appId:   "com.ferdaracing.app",
  appName: "FERDA Racing",

  // ─── Web source ─────────────────────────────────────────────────────────────
  // Points at the Vite build output. Run `npm run build && npx cap sync` to
  // push a new web build into the native projects.
  webDir: "dist",

  // ─── Server (live-reload during development) ────────────────────────────────
  // Uncomment the url line and set it to your local dev server to enable
  // hot-reload on device while developing:
  //
  // server: {
  //   url: "http://192.168.x.x:5173",   // ← your machine's LAN IP
  //   cleartext: true,
  // },

  // ─── iOS ────────────────────────────────────────────────────────────────────
  ios: {
    scheme: "FERDA Racing",
    // contentInset: "automatic",
  },

  // ─── Android ────────────────────────────────────────────────────────────────
  android: {
    allowMixedContent: false,
  },

  // ─── Plugins ────────────────────────────────────────────────────────────────
  plugins: {
    // Native push notifications (APNs on iOS, FCM on Android)
    // These fire on the lock screen even when the app is closed —
    // more reliable than Web Push on mobile.
    // Setup guide in NATIVE_APP.md
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },

    // Keeps the splash screen visible until we explicitly hide it
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor:    "#0a0e17",
      showSpinner:        false,
      androidSplashResourceName: "splash",
      iosSplashResourceName:     "Splash",
    },

    // Status bar styling (dark background → light icons)
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
  },
};

export default config;
