# Android wrapper for the web music app

## Overview
This project includes a complete Android wrapper that hosts your web app in a WebView and adds a native background playback service powered by Media3 ExoPlayer.

## Files added
- android/ – Android Gradle project
- android/app/src/main/java/com/example/yourapp/MainActivity.kt – WebView host and JS bridge
- android/app/src/main/java/com/example/yourapp/MusicService.kt – background playback service
- android/app/src/main/java/com/example/yourapp/NotificationHelper.kt – foreground notification
- android/app/src/main/AndroidManifest.xml – permissions and service declaration
- .github/workflows/android-release.yml – GitHub Actions release workflow

## Build locally
1. Copy your web app into android/app/src/main/assets/webapp/ (or update the WebView loader to point at your existing webapp folder).
2. Replace package names and app names in the Android project.
3. From the android folder run:
   - ./gradlew assembleRelease

## Signing release builds
Generate a keystore:

```bash
keytool -genkey -v -keystore android/app/keystore.jks -storetype JKS \
  -keyalg RSA -keysize 2048 -validity 10000 -alias your-alias
```

Then build:

```bash
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=app/keystore.jks \
  -Pandroid.injected.signing.store.password=YOUR_STORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=YOUR_ALIAS \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD
```

## GitHub Actions release
Set these repository secrets:
- KEYSTORE_BASE64
- KEYSTORE_PASSWORD
- KEY_ALIAS
- KEY_PASSWORD

Create a tag like:

```bash
git tag v1.0.0
git push origin v1.0.0
```
