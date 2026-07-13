import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";

const stripQuotes = (val) => val ? val.replace(/^"|"$/g, '').replace(/^'|'$/g, '') : val;

const firebaseConfig = {
  apiKey: stripQuotes(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: stripQuotes(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: stripQuotes(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: stripQuotes(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: stripQuotes(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: stripQuotes(import.meta.env.VITE_FIREBASE_APP_ID)
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

