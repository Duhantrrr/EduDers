/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Using initializeFirestore instead of getFirestore to pass settings
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Fix for transport errors in preview
}, (firebaseConfig as any).firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();

// Collection names
export const EVENTS_COLLECTION = 'events';
export const SCHEDULE_COLLECTION = 'schedule';

export { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp };
