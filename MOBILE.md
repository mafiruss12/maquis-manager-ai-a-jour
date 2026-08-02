# Maquis Manager — Application mobile (Android)

## Prérequis

- Node.js 18+
- Android Studio (pour générer l’APK / AAB)
- Compte [Google Play Console](https://play.google.com/console) (~25 $ une fois) pour publier

## Générer l’APK (debug)

```bash
# 1. Installer les dépendances
npm install --legacy-peer-deps

# 2. Build web + synchroniser Capacitor
npm run build
npx cap add android   # une seule fois
npx cap sync android

# 3. Ouvrir dans Android Studio
npx cap open android
```

Dans Android Studio : **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Ou en ligne de commande :

```bash
cd android && ./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

## APK de production (signature)

```bash
cd android && ./gradlew assembleRelease
```

Il faut un keystore de signature (Android Studio → Generate Signed Bundle / APK).

## Publication Play Store

1. Créer une app sur Google Play Console  
2. Uploader un **AAB** : `./gradlew bundleRelease`  
3. Remplir fiche store, captures d’écran, politique de confidentialité  

## iOS (App Store)

Nécessite un **Mac** + compte Apple Developer (99 $/an) :

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Sécurité

- Seule la clé **anon** Supabase est embarquée (jamais `service_role`)
- RLS activé sur toutes les tables
- HTTPS forcé (scheme Capacitor)
- Sessions Auth persistées de façon sécurisée côté client
- Mode hors ligne : file d’attente locale, sync au retour réseau

## Web

Toujours disponible : https://maquis-manager-ai-a-jour.vercel.app
