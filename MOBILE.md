# Maquis Manager — Mobile (APK)

## Domaine officiel (web + APK)

**https://maquis-mananger.vercel.app**

L’APK Capacitor charge cette URL (`capacitor.config.ts` → `server.url`).

## Build APK

```bash
git clone https://github.com/mafiruss12/maquis-manager-ai-a-jour.git
cd maquis-manager-ai-a-jour
npm install --legacy-peer-deps
npm run build:mobile
npx cap add android   # une seule fois
npx cap sync android
npx cap open android  # puis Build → APK
```

Ou :

```bash
npm run android:apk
```

L’APK générée ouvre automatiquement **https://maquis-mananger.vercel.app**.

## Mise à jour sans rebuilder

Comme l’app charge le site live, **Mettre à jour** dans Paramètres suffit pour les nouvelles fonctions web.
Pour une nouvelle APK native (icônes, plugins), republier une release GitHub.
