
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
 * Configura caché en memoria para evitar errores de aserción interna y bloqueos de persistencia
 * en entornos de desarrollo o múltiples pestañas del navegador.
 */
export function initializeFirebase() {
  if (typeof window !== 'undefined') {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      // Evita IndexedDB en desarrollo para prevenir FIRESTORE INTERNAL ASSERTION FAILED
      db = initializeFirestore(app, {
        localCache: memoryLocalCache()
      });
      auth = getAuth(app);
      storage = getStorage(app);
    } else {
      app = getApp();
      db = getFirestore(app);
      auth = getAuth(app);
      storage = getStorage(app);
    }
  }
  return { app, db, auth, storage };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
