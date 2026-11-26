# Putting the app online (Cloudflare Pages, free)

Cloudflare Pages hosts the built app for free: unlimited bandwidth, 500 builds a month, HTTPS included. No credit card is needed.

## 1. One-time setup (about 10 minutes)

1. Sign up at <https://dash.cloudflare.com/sign-up>. Use the free plan and don't add a card.
2. Go to **Workers & Pages → Create → Pages → Connect to Git** and pick the GitHub repo `jay-singh-01/sumiz`.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | None (or Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(leave empty)* |

4. Under **Environment variables (Production)**, add the same values as your `.env.local`:

   ```
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_APP_ID
   VITE_FIREBASE_MESSAGING_SENDER_ID
   NODE_VERSION = 24
   ```

   These are public web-app identifiers, not secrets. The security rules protect the data. Never add `VITE_USE_EMULATORS` here.

5. Click **Save and Deploy**. You get a URL such as `https://gota-dhaaga.pages.dev`.
6. **Allow sign-in from that URL.** In the Firebase console, go to **Security → Authentication → Settings → Authorized domains → Add domain** and add `gota-dhaaga.pages.dev`. Add your custom domain too if you use one. Google sign-in fails with `auth/unauthorized-domain` until you do this.

`public/_redirects` sends every path to `index.html`, so links like `/orders/abc` work on reload.

## 2. Every update

Push to `main`. Cloudflare builds and publishes within a couple of minutes. Phones pick up the new version the next time the app is opened, because the PWA updates itself in the background. Your data is never touched by a deploy.

When `firestore.rules` changes, publish it separately in **Firebase console → Databases & Storage → Firestore → Rules**: paste the file and click **Publish**. The proxy blocks `firebase deploy` on the office network.

## 3. Install on Sumitra's phone

1. Open the URL in **Chrome** on the Android phone.
2. Tap **⋮ → Install app** (or "Add to Home screen"). The गोटा & धागा icon appears on the home screen.
3. Open it, sign in with Google once, and set the 4-digit PIN.
4. Keep the phone online for a minute so all records download. After that it works without internet.

## 4. Optional custom domain

In the Pages project, use **Custom domains → Set up a domain**. A domain costs money, so this is optional. The free `*.pages.dev` address works permanently.

## Free-tier headroom (for a single shop)

| Service | Free limit | Expected use |
|---|---|---|
| Firestore reads | 50,000 / day | a few hundred (delta sync reads only changed records) |
| Firestore writes | 20,000 / day | under 500 |
| Firestore storage | 1 GiB | about 50 MB after 5 years |
| Cloudflare Pages | unlimited requests | — |
| Cloudinary | 25 credits / month (~25 GB) | photos are compressed to ≤300 KB, so thousands fit |
| GitHub Actions (private repo) | 2,000 min / month | about 30 min (nightly backup) |
