# FERDA Racing — Native App Setup

Capacitor wraps the existing web app into a real iOS / Android app.
The web code is the source of truth — no duplicate logic.

---

## Prerequisites

| Tool | Mac (iOS) | Windows (Android) |
|---|---|---|
| Node 20+ | ✅ already installed | ✅ already installed |
| Xcode 15+ | Required for iOS | Not needed |
| Android Studio | Optional | Required |
| CocoaPods | `sudo gem install cocoapods` | Not needed |

---

## First-time setup (run once)

```bash
# 1. Build the web app and generate native projects
npm run build
npx cap add ios       # creates ios/ directory
npx cap add android   # creates android/ directory
npx cap sync          # copies dist/ into native projects
```

---

## Daily workflow

```bash
# Build + sync in one command
npm run sync

# Open Xcode (iOS)
npm run open:ios

# Open Android Studio
npm run open:android
```

---

## iOS — App Store submission checklist

1. **Xcode** → open `ios/App/App.xcworkspace`
2. Set your **Team** in Signing & Capabilities (requires paid Apple Developer account, $99/yr)
3. Set **Bundle Identifier**: `com.ferdaracing.app`
4. Add app icons to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
   - 1024×1024 PNG (no alpha, no rounded corners — Apple adds those)
   - Use [makeappicon.com](https://makeappicon.com) to generate all sizes from one image
5. Add splash screen image to `ios/App/App/Assets.xcassets/Splash.imageset/`
6. **Product → Archive → Distribute App → App Store Connect**

### Push notifications (APNs) — iOS
1. In your Apple Developer account → **Certificates, Identifiers & Profiles**
   → create an **APNs key** (.p8 file) — download and keep safe
2. In Firebase Console → Project Settings → Cloud Messaging → APNs key upload
3. Install the plugin: `npm install @capacitor/push-notifications && npx cap sync`
4. In Xcode → Signing & Capabilities → add **Push Notifications** + **Background Modes → Remote notifications**

---

## Android — Play Store submission checklist

1. **Android Studio** → open `android/` folder
2. Set **applicationId** in `android/app/build.gradle`: `"com.ferdaracing.app"`
3. Add app icons to `android/app/src/main/res/` (mipmap-* folders)
   - Use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) to generate
4. Create a signed APK/AAB:
   **Build → Generate Signed Bundle/APK** → follow wizard to create a keystore
   ⚠️ **Keep the keystore file safe** — losing it means you can never update the app
5. Upload the `.aab` to [Google Play Console](https://play.google.com/console)

### Push notifications (FCM) — Android
1. In Firebase Console → Project Settings → **google-services.json** → download
2. Copy `google-services.json` to `android/app/`
3. Install the plugin: `npm install @capacitor/push-notifications && npx cap sync`
4. FCM works automatically on Android — no extra cert setup needed

---

## App icons to create

| Asset | Size | Format |
|---|---|---|
| iOS App Icon | 1024×1024 | PNG, no alpha |
| Android Launcher Icon | 512×512 | PNG |
| Splash Screen | 2732×2732 | PNG, centered logo |

Suggested: dark background `#0a0e17`, FERDA logo centered in gold/white.

---

## VAPID push notifications (web browser) vs. native push

| | Web Push (current) | Native Push (Capacitor) |
|---|---|---|
| iOS Safari | PWA only, iOS 16.4+ | Always works |
| Android Chrome | ✅ | ✅ |
| Lock screen | ✅ | ✅ |
| Setup | VAPID keys in Vercel | APNs key + FCM JSON |
| Works when app closed | ✅ | ✅ |

For maximum reach: keep both. Web push covers browser users; native push covers App Store installs.

---

## Version bumping

Before each App Store / Play Store release, bump the version in `package.json`
and the native configs:

- iOS: `ios/App/App.xcodeproj/project.pbxproj` → `MARKETING_VERSION`
- Android: `android/app/build.gradle` → `versionName` and `versionCode`

Or use: `npx @capacitor/cli version X.Y.Z` (updates all three).
