import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      const serviceAccount = JSON.parse(serviceAccountStr);
      // Ensure Vercel's stringified newlines are converted to actual newlines
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error("Firebase admin initialization error. Check FIREBASE_SERVICE_ACCOUNT env var.", error);
  }
}

export const db = getApps().length ? getFirestore() : null;
