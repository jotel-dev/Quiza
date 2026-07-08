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

export const submitScoreToLeaderboard = async (address, correct, total, streak) => {
  if (!address) return;
  
  const playerRef = doc(db, "players", address);
  const playerSnap = await getDoc(playerRef);
  
  const points = correct * 10;
  
  if (playerSnap.exists()) {
    await updateDoc(playerRef, {
      gamesPlayed: increment(1),
      totalPoints: increment(points),
      correctAnswers: increment(correct),
      totalQuestions: increment(total),
      streak: streak,
      lastUpdated: serverTimestamp()
    });
  } else {
    await setDoc(playerRef, {
      address: address,
      username: address.slice(0, 6) + "...",
      gamesPlayed: 1,
      totalPoints: points,
      correctAnswers: correct,
      totalQuestions: total,
      streak: streak,
      lastUpdated: serverTimestamp()
    });
  }
};
