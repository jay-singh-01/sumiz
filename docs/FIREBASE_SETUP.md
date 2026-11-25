# Firebase setup (free Spark plan, no billing)

Takes about 10 minutes. **At no point add a billing account or click "Upgrade" / "Blaze".**
If any screen asks for a card, stop: you've wandered into a paid feature.

## 1. Create the project

1. Open <https://console.firebase.google.com> and sign in with the Google account that should *own* the data (your own account is best; add your mother as a user later).
2. Click **Create a project** (or **Add project**).
3. Name: `gota-dhaaga`. Firebase will suggest a project ID such as `gota-dhaaga-1a2b3`. **Write the project ID down.**
4. **Google Analytics:** turn it **off** (not needed, keeps things simple).
5. Click **Create project** and wait. The project starts on the **Spark (no-cost)** plan. Check the plan badge at the bottom of the left sidebar.

## 2. Register the web app

1. On the project overview, click the **`</>` (Web)** icon.
2. App nickname: `gota-dhaaga-web`. **Do not** tick "Also set up Firebase Hosting" (we use Cloudflare Pages).
3. Click **Register app**. You'll see a `firebaseConfig` object. Copy these values into a new file `.env.local` at the repo root (start from `.env.example`):

   | firebaseConfig key | .env.local variable |
   |---|---|
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |

   (The web config isn't a secret, because security comes from Firestore rules, but we still keep it out of git.)

## 3. Turn on Google Sign-In

1. Left sidebar → **Product categories → Security → Authentication → Get started**. (Older consoles call this section **Build**. If you can't find it, type "Authentication" in **Search for products** at the top left.)
2. **Sign-in method** tab → **Google** → **Enable**.
3. Choose a **project support email** (your Gmail) → **Save**.
4. Don't enable Phone sign-in (SMS is billed).
5. **Settings → Authorized domains**: `localhost` is already there. After the first Cloudflare Pages deploy (Phase 12), add `<your-site>.pages.dev` here.

## 4. Create the Firestore database

1. Left sidebar → **Product categories → Databases & Storage → Firestore → Create database**. (Older consoles: **Build → Firestore Database**. Or search "Firestore".)
2. Database ID: keep **`(default)`**. Only the default database gets the free quota.
3. **Location: `asia-south1` (Mumbai)**. ⚠️ This is permanent and can't be changed later.
4. Start in **production mode** (everything locked). Our own rules get deployed in the next step.
5. Don't enable Point-in-time recovery or scheduled backups. They need billing; our GitHub backups (Phase 9) replace them.

## 5. Connect this repo to the project

```powershell
npx firebase login
npx firebase use --add          # pick your project id, alias it "prod"
npx firebase deploy --only firestore:rules,firestore:indexes
```

`.firebaserc` keeps `demo-gota-dhaaga` as the default so emulator work can never touch real data. Use `--project prod` (or `npx firebase use prod`) when deploying.

## 6. Service account for nightly backups (Phase 9, can wait)

Project settings → **Service accounts** → **Generate new private key**. Don't save the downloaded JSON in the repo. It goes into a GitHub Secret (`FIREBASE_SERVICE_ACCOUNT`) only, and you delete the local copy after that.

## Check you're still free

Console → ⚙️ → **Usage and billing** should say **Spark plan** with no billing account linked.
