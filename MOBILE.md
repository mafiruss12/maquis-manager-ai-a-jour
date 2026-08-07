# Maquis Manager — APK Android offline (sans Play Store)

Application **open source** : code sur GitHub.  
APK installable directement sur le téléphone (sources inconnues).

## Ce que fait le mode offline

| Situation | Comportement |
|-----------|----------------|
| Première ouverture **avec** Internet | Télécharge produits, session, écrans |
| Coupure réseau | L’app **reste ouverte** (shell + données en cache) |
| Caisse / Inventaire / Dépenses hors ligne | Enregistrés en local (IndexedDB) + file d’attente |
| Retour Internet | Sync automatique vers Supabase (bannière « Hors ligne ») |

> Il faut s’être connecté **au moins une fois en ligne** pour avoir les données en cache.

## Prérequis sur un PC

1. **Node.js 18+** — https://nodejs.org  
2. **Android Studio** — https://developer.android.com/studio  
   - Installe le SDK Android + un device/emulator optionnel  
3. Java 17 (fourni souvent avec Android Studio)

## Générer l’APK (debug) — 5 commandes

```bash
git clone https://github.com/mafiruss12/maquis-manager-ai-a-jour.git
cd maquis-manager-ai-a-jour

npm install --legacy-peer-deps

# Build web pour Capacitor (chemins relatifs)
VITE_BASE=./ npm run build

# Créer le projet Android (une seule fois)
npx cap add android

# Copier le web dans Android
npx cap sync android
```

### Option A — Android Studio (recommandé)

```bash
npx cap open android
```

Puis : **Build → Build Bundle(s) / APK(s) → Build APK(s)**  

Fichier produit :
`android/app/build/outputs/apk/debug/app-debug.apk`

### Option B — Ligne de commande

```bash
cd android
./gradlew assembleDebug
# APK : app/build/outputs/apk/debug/app-debug.apk
```

## Installer sur le téléphone (sans Play Store)

1. Envoie le fichier `app-debug.apk` (WhatsApp, Drive, USB…)  
2. Sur Android : **Paramètres → Sécurité → Installer des apps inconnues** (autorise Chrome/Fichiers)  
3. Ouvre le `.apk` → **Installer**  
4. Ouvre **Maquis Manager** → connecte-toi **une fois avec Internet**  
5. Tu peux ensuite travailler hors ligne (caisse, stock, dépenses)

## APK de production (signature)

Pour une APK signée (plus stable, mises à jour) :

1. Android Studio → **Build → Generate Signed Bundle / APK**  
2. Crée un **keystore** (garde le mot de passe en lieu sûr)  
3. Génère **APK release**

Ou :
```bash
cd android && ./gradlew assembleRelease
```

## Identité de l’app

- **App ID** : `com.maquismanager.app`  
- **Nom** : Maquis Manager  
- Config : `capacitor.config.ts`

## Scripts npm utiles

```bash
npm run build              # site web
VITE_BASE=./ npm run build # build pour APK
npm run cap:sync           # build + sync Android
npm run android:apk        # sync + assembleDebug (si SDK installé)
```

## Open source

- Repo public GitHub  
- Capacitor, React, Vite : licences open source  
- Tu peux redistribuer l’APK librement (hors Play Store)

## Limites actuelles

- iOS : pas d’APK (autre process App Store / TestFlight)  
- Sync offline : prioritaire sur **Caisse, Inventaire, Dépenses**  
- Play Store : optionnel plus tard (~25 $ une fois)
