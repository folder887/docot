# Building docot

docot is a single React + Vite codebase that ships as:

- **Web app** (PWA) — primary platform
- **Desktop** — Linux (.AppImage, .deb), Windows (.exe via NSIS), macOS (.dmg) via [Tauri](https://tauri.app)
- **Mobile** — Android (.apk), iOS via [Capacitor](https://capacitorjs.com)
- **Backend** — FastAPI on Fly.io

## Web

```bash
npm install
npm run build           # static dist/ for any host or PWA install
VITE_API_URL=https://docot-backend-ryhccesj.fly.dev npm run build
```

Set `VITE_API_URL` to point the bundle at your backend at build time.

## Desktop (Tauri 2.x)

Prereqs: Rust (`rustup default stable`) and platform-specific webview libs.

### Linux

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev \
  librsvg2-dev libgtk-3-dev libsoup-3.0-dev patchelf file

npm install
npm run tauri:deb           # produces src-tauri/target/release/bundle/deb/*.deb
APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri:appimage   # *.AppImage
```

`APPIMAGE_EXTRACT_AND_RUN=1` is required when building inside containers / CI without FUSE.

### Windows

On a Windows machine with Rust + the WebView2 runtime:

```powershell
npm install
npm run tauri:nsis          # produces src-tauri/target/release/bundle/nsis/*.exe
```

### macOS

On a macOS machine:

```bash
npm install
npm run tauri:dmg           # produces src-tauri/target/release/bundle/dmg/*.dmg
```

## Mobile (Capacitor)

### Android

Prereqs: JDK 17, Android Studio (or the Android SDK CLI tools + a build-tools image).

```bash
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug     # produces app/build/outputs/apk/debug/app-debug.apk
```

For a release build you'll need to set up a signing config in `android/app/build.gradle`.

### iOS

Prereqs: macOS, Xcode, an Apple Developer account.

```bash
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios            # opens Xcode
```

## CI

`.github/workflows/release.yml` builds for Linux, Windows, macOS and Android on
every git tag matching `v*`. Push a tag to publish a GitHub Release with all
artifacts attached:

```bash
git tag v0.1.0
git push --tags
```
