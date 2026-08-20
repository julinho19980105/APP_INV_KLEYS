'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;

/**
 * Inicializa los servicios de Firebase utilizando un patrón Singleton.
 * Se utiliza memoryLocalCache para evitar errores de aserción interna (Assertion Failed)
 * causados por conflictos en IndexedDB durante el desarrollo y recargas HMR.
 */
export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        // Forzamos caché en memoria para evitar el error "FIRESTORE INTERNAL ASSERTION FAILED"
        db = initializeFirestore(app, {
          localCache: memoryLocalCache()
        });
      } else {
        app = getApp();
        db = getFirestore(app);
      }
      auth = getAuth(app);
      storage = getStorage(app);
    } catch (e) {
      console.warn("Firebase ya inicializado o error en caché:", e);
      app = getApp();
      db = getFirestore(app);
      auth = getAuth(app);
      storage = getStorage(app);
    }
    return { app, db, auth, storage };
  }
  return { app: null, db: null, auth: null, storage: null };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
