# Across Town

A private game room for two: 26 games, chat with nudges, a head-to-head scoreboard and stakes. It installs on an iPhone or an Android phone from the browser.

- **App:** `docs/`, served by GitHub Pages.
- **Data:** Firebase. Accounts use Firebase Authentication, games and chat live in Cloud Firestore, and live views run on the Realtime Database.
- **Privacy:** the code in this repo holds no personal data. Games and chat live in Firebase, and the rules in `firestore.rules` and `database.rules.json` only let the two people in a room read or write it.

## One-time setup

### 1. Firebase (about 10 minutes, free plan)
1. Go to https://console.firebase.google.com, choose **Create a project** and name it `across-town`. Google Analytics can be off.
2. **Build → Authentication → Get started.** Turn on **Email/Password**, and **Google** too if you want it.
3. **Build → Firestore Database → Create database.** Choose **production mode** and the location **asia-south1 (Mumbai)**.
4. **Build → Realtime Database → Create database.** Choose the location **asia-southeast1 (Singapore)** and **locked mode**.
5. Paste in the rules:
   - In Firestore → **Rules**, replace everything with the contents of `firestore.rules`, then **Publish**.
   - In Realtime Database → **Rules**, replace everything with the contents of `database.rules.json`, then **Publish**.
6. Open **Project settings** (gear icon) → **General** → **Your apps** and click the web icon `</>`. Register the app as `Across Town`; Hosting is not needed. Copy the `firebaseConfig` values into `docs/firebase-config.js`. These values only identify the project and are safe in a public repo; the rules protect the data.
7. Under **Authentication → Settings → Authorized domains**, add `YOUR-GITHUB-USERNAME.github.io`. Google sign-in needs this.

### 2. GitHub Pages
1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set the source to **Deploy from a branch**, branch `main`, folder `/docs`.
3. The app is then live at `https://YOUR-GITHUB-USERNAME.github.io/across-town/`.

## Installing on phones
- **Android (Chrome):** open the link, then ⋮ menu → **Install app**.
- **iPhone (Safari, not Chrome):** open the link, tap **Share → Add to Home Screen**, then open it from the home screen. In the installed iPhone app, sign in with email and password, because Google's sign-in window can't open there.

## Getting into a room
1. The first person signs up and taps **Create our room**. The app shows an 8-letter code.
2. The second person signs up, enters the code and taps **Join their room**. Each code works once, and a room is closed once two people are in it.

## Changing the app
The source is in `src/`, and the Firebase layer is in `fb/fb.js`. Rebuild with:

```
(cd fb && npm install) && python3 build.py
```

Then commit the updated `docs/` folder.
