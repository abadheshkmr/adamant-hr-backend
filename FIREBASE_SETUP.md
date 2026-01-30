# Firebase Admin Setup (Candidate Portal Auth)

The candidate portal uses Firebase Authentication with **Google Sign-in only**. The backend must verify Firebase ID tokens using the **Firebase Admin SDK**.

## 1. Enable Google Sign-in (Frontend)

1. Go to https://console.firebase.google.com → your project
2. **Authentication** → **Sign-in method**
3. Click **Google** → **Enable** → Save
4. Add your app's authorized domains (e.g. `localhost` for dev)

## 2. Backend Service Account (2 minutes)

1. **Open Firebase Console**
   - Go to https://console.firebase.google.com
   - Select your project: **adamanthr-b6f7c**

2. **Download Service Account Key**
   - Click the gear icon → **Project Settings**
   - Go to **Service Accounts** tab
   - Click **Generate new private key** → Confirm
   - A JSON file will download

3. **Add to Backend**
   - Rename the downloaded file to `firebase-service-account.json`
   - Place it in the `hr-backend` folder (same level as `server.js`)
   - Ensure `.env` has:
     ```
     FIREBASE_PROJECT_ID=adamanthr-b6f7c
     FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
     ```

4. **Restart the backend**
   ```bash
   npm run start
   ```

5. **Verify**
   - Sign in with Google on the portal, then visit Dashboard
   - First-time users will see a "Complete Your Profile" screen (add mobile number)
   - If you see "Firebase auth not configured" → the service account file is missing or path is wrong

## Security

- **Never commit** `firebase-service-account.json` to git (it's in `.gitignore`)
- For production, use environment variables or a secrets manager
