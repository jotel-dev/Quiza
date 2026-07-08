import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const stripQuotes = (val) => val ? val.replace(/^"|"$/g, '').replace(/^'|'$/g, '') : val;

const app = initializeApp({
  apiKey: stripQuotes(process.env.VITE_FIREBASE_API_KEY),
  projectId: stripQuotes(process.env.VITE_FIREBASE_PROJECT_ID),
  authDomain: stripQuotes(process.env.VITE_FIREBASE_AUTH_DOMAIN)
});

const db = getFirestore(app);
const q = query(collection(db, 'players'), orderBy('totalPoints', 'desc'), limit(50));

getDocs(q).then(snap => {
  console.log('Players:', snap.size);
  process.exit(0);
}).catch(e => {
  console.error('Query error:', e);
  process.exit(1);
});
