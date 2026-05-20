/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeFirestore, collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Safety check for empty config
if (!firebaseConfig || !Object.keys(firebaseConfig).length) {
  console.warn('Firebase config is empty. Ensure Firebase is set up in AI Studio.');
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig || {}) : getApp();

// Using initializeFirestore instead of getFirestore to pass settings
const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId);

// Collection names
export const EVENTS_COLLECTION = 'events';
export const SCHEDULE_COLLECTION = 'schedule';

export { collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, Timestamp, writeBatch };
