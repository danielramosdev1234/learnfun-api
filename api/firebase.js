import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAt2pGCDu7UgdRBGvOFb98jwdUNE_vydiI",
  authDomain: "learnfun-2e26f.firebaseapp.com",
  projectId: "learnfun-2e26f",
  storageBucket: "learnfun-2e26f.firebasestorage.app",
  messagingSenderId: "620241304009",
  appId: "1:620241304009:web:0ba10caafa660e99a89018",
  measurementId: "G-KB84MN7XFX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);