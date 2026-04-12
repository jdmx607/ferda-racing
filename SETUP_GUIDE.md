# FERDA Racing League — Setup & Deploy Guide

This gets your fantasy NASCAR app live on the internet in about 30 minutes. You need: a computer, a web browser, and basic ability to copy/paste commands.

---

## STEP 1: Install Node.js (if you don't have it)

1. Go to https://nodejs.org
2. Download the **LTS** version (big green button)
3. Install it (just click Next through the installer)
4. Open **Command Prompt** (Windows) or **Terminal** (Mac)
5. Verify it works:
   ```
   node --version
   npm --version
   ```
   Both should show a version number. If they do, you're good.

---

## STEP 2: Create a Firebase Project (free)

This is your shared database so all 4 players can see the same data.

1. Go to https://console.firebase.google.com
2. Sign in with your Google account
3. Click **"Create a project"** (or "Add project")
4. Name it `ferda-racing` → click Continue
5. Turn OFF Google Analytics (you don't need it) → click Create Project
6. Wait for it to finish, then click Continue

### 2b: Create the Database

1. In the left sidebar, click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Select **"Start in test mode"** → click Next
4. Pick the closest location (e.g., `us-east1`) → click Enable
5. Wait for it to create

### 2c: Get Your Config Keys

1. In the left sidebar, click the **gear icon** → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click the **web icon** `</>` (looks like angle brackets)
4. Give it a nickname: `ferda-web` → click **Register app**
5. You'll see a code block with `firebaseConfig`. It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "ferda-racing.firebaseapp.com",
     projectId: "ferda-racing",
     storageBucket: "ferda-racing.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
6. **Copy these values** — you'll paste them in the next step

---

## STEP 3: Add Your Firebase Config

1. Open the file `src/firebase.js` in any text editor (Notepad works)
2. Find the section that says `YOUR_API_KEY`, `YOUR_PROJECT`, etc.
3. Replace those placeholders with your real values from Step 2c
4. Save the file

---

## STEP 4: Test It Locally

Open Command Prompt / Terminal, navigate to the project folder:

```
cd path/to/ferda-racing
```

Then run:

```
npm install
npm run dev
```

It will say something like `Local: http://localhost:5173`. Open that URL in your browser. You should see the FERDA login screen. Log in as Justin (password: ferda1) and check that standings show your imported data.

If it works, press `Ctrl+C` to stop the server.

---

## STEP 5: Create a GitHub Repository

1. Go to https://github.com and sign in (or create a free account)
2. Click the **+** in the top right → **"New repository"**
3. Name it `ferda-racing`
4. Keep it **Public** (required for free Vercel hosting)
5. Do NOT check "Add a README" (we already have files)
6. Click **"Create repository"**

### 5b: Push Your Code

If you don't have Git installed, download it from https://git-scm.com

In your terminal, inside the `ferda-racing` folder:

```
git init
git add .
git commit -m "FERDA Racing League v1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ferda-racing.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## STEP 6: Deploy on Vercel (free)

1. Go to https://vercel.com
2. Click **"Sign Up"** → sign in with your GitHub account
3. Click **"Add New..."** → **"Project"**
4. Find `ferda-racing` in your repo list → click **Import**
5. Leave all settings as default (Vercel auto-detects Vite)
6. Click **"Deploy"**
7. Wait about 60 seconds...
8. You'll get a URL like: `https://ferda-racing.vercel.app`

**That's your live site.** Share that URL with Big Monroe, Monroe, and Rich.

---

## STEP 7: Share With Your Players

Send the boys the link and their login credentials:

| Player     | Password |
|------------|----------|
| Justin     | ferda1   |
| Big Monroe | ferda2   |
| Monroe     | ferda3   |
| Rich       | ferda4   |

To change passwords later, just edit the `PLAYERS` array in `src/App.jsx` and redeploy.

---

## How to Redeploy After Changes

Any time you push to GitHub, Vercel auto-deploys:

```
git add .
git commit -m "Updated something"
git push
```

That's it. Vercel picks it up and your site updates in about 30 seconds.

---

## Troubleshooting

**"Firebase error" or blank screen:**
- Double-check your config values in `src/firebase.js`
- Make sure Firestore is in **test mode** (not production mode)

**Players can't see each other's picks:**
- That's by design via Firebase real-time sync. If it's not working, check the browser console (F12) for errors.

**Want to reset all data:**
- Go to Firebase Console → Firestore → delete the `leagues` collection
- Refresh the app — it will recreate with the Week 1-7 imported data

**Need to change the Firestore security rules later:**
- Go to Firebase Console → Firestore → Rules tab
- For now, test mode is fine for your 4-person league
- Test mode expires after 30 days — when it does, replace the rules with:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /leagues/{doc} {
        allow read, write: if true;
      }
    }
  }
  ```

---

## What's Next (Future Features)

- Live NASCAR API integration for automatic scoring
- Mobile-optimized responsive design improvements
- Player-to-player trash talk / chat
- Historical season archive
- Draft system for driver selection
- Push notifications for pick deadlines
