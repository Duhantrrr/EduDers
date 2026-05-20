/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error('Login Error:', error);
    // If popup is blocked, we could potentially retry with redirect or show a message
    throw error;
  }
};

export const signOut = () => auth.signOut();

// Collection names
export const EVENTS_COLLECTION = 'events';
export const SCHEDULE_COLLECTION = 'schedule';

export { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp };
