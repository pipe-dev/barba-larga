
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

// IMPORTANT: These would be the details from your NEW Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyCcGUogatGkZ_4GJlXuykdE44omkcjcbpM",
  authDomain: "barba-larga-app-v2.firebaseapp.com",
  projectId: "barba-larga-app-v2",
  storageBucket: "barba-larga-app-v2.appspot.com",
  messagingSenderId: "895613741495",
  appId: "1:895613741495:web:2ca5d8ce7757d5fd112032",
  measurementId: "G-0D558F6DVS"
};

// Initialize Firebase
// This pattern prevents re-initializing the app on hot reloads.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db: ReturnType<typeof getFirestore>;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}

export { app, db };
