import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env['VITE_FIREBASE_API_KEY'] as string,
  authDomain:        import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
  projectId:         import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
  storageBucket:     import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'] as string,
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
  appId:             import.meta.env['VITE_FIREBASE_APP_ID'] as string,
};

// Guard against duplicate initialization (HMR / multiple imports)
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
