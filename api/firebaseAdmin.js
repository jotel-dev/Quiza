import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error("Firebase admin initialization error. Check FIREBASE_SERVICE_ACCOUNT env var.", error);
  }
}

export const db = admin.apps.length ? admin.firestore() : null;
