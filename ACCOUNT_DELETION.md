# How to Delete Your Account & Data — Paisa

This document describes how users can permanently delete their Paisa account and all associated data.

---

## What Gets Deleted

When you delete your account, the following is **permanently and irreversibly removed**:

- Your Firebase Authentication account (email, password)
- Your user profile (name, profile photo)
- All wallets you created
- All transactions linked to those wallets
- All uploaded receipt images and wallet icons

This action **cannot be undone**.

---

## Steps to Delete Your Account In-App

1. Open the **Paisa** app and sign in if prompted
2. Tap the **Profile** tab at the bottom of the screen
3. Tap **Settings**
4. Tap **Delete Account & Data**
5. Read the confirmation message carefully
6. Tap **Delete Everything** to confirm

Your account and all data will be deleted immediately. You will be automatically signed out and returned to the welcome screen.

---

## If You See "Re-authentication Required"

For security, Firebase requires that your sign-in session is recent before allowing account deletion. If you see this message:

1. Tap **OK** to dismiss the alert
2. Tap **Logout** on the Profile screen
3. Sign back in with your email and password
4. Immediately go back to **Profile → Settings → Delete Account & Data**
5. Tap **Delete Everything**

---

## Alternative: Request Deletion by Email

If you are unable to access the app, you can request manual deletion by contacting us:

**Email:** [your-contact-email@domain.com]

Include in your email:
- The email address associated with your account
- Subject line: "Account Deletion Request — Paisa"

We will permanently delete your account and all associated data within **7 business days** and send you a confirmation email.

---

## Data Hosted on Third-Party Services

| Service | Data stored | Deletion |
|---|---|---|
| Firebase Authentication | Email, password hash, UID | Deleted automatically when you delete your account in-app |
| Firebase Firestore | Profile, wallets, transactions | Deleted automatically when you delete your account in-app |
| Cloudinary | Profile photos, wallet icons, receipt images | Deleted automatically when you delete your account in-app |
| AsyncStorage (device) | Auth session token | Cleared automatically on sign-out |

---

## Contact

For questions about data deletion or privacy:

**Email:** [your-contact-email@domain.com]
**App:** Paisa (`com.aths7.paisav5`)
