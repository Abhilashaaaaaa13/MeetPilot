import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { isSupported, getAnalytics } from "firebase/analytics";

// CHANGED: values come from env vars, not hardcoded -- this file gets
// committed to git, and an API key sitting in source is a real leak even
// though Firebase web API keys aren't secret in the traditional sense
// (they're scoped by domain/App Check, not by being hidden) -- still,
// keep config in one place (.env.local) rather than duplicated in code.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// CHANGED: getAnalytics() reads `window`, which doesn't exist during
// Next.js server-side rendering -- calling it unguarded at module scope
// crashes the build the moment this file is imported anywhere SSR touches.
// isSupported() also weeds out browsers/environments (e.g. some in-app
// webviews) where Analytics silently can't run.
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) getAnalytics(app);
  });
}