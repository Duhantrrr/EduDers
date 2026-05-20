/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { initializeFirestore, collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Safety check for empty config
if (!firebaseConfig || !Object.keys(firebaseConfig).length) {
  console.warn('Firebase config is empty. Ensure Firebase is set up in AI Studio.');
}

const app = initializeApp(firebaseConfig || {});

// Using initializeFirestore instead of getFirestore to pass settings
const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
console.log('Initializing Firestore with DB ID:', dbId);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId);
console.log('Firestore initialized successfully');

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error('Login Error:', error);
    throw error;
  }
};

export const signOut = () => auth.signOut();

// Collection names
export const EVENTS_COLLECTION = 'events';
export const SCHEDULE_COLLECTION = 'schedule';

export { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp, writeBatch };
