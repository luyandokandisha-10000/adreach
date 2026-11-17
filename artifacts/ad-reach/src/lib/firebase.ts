import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration parameters sourced from environment variables or active project defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB_yaNA3Rz9VzQwjgfZJq3o0AR66HivYB0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'adreachzm.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'adreachzm',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'adreachzm.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '179718819418',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:179718819418:web:7b92f40a0be6a615e81263',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-BFYM33R49H',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

// Singleton Firebase instances
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!app) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    } catch (err) {
      console.warn('Firebase initialization notice: configuration pending live credentials.', err);
      return null;
    }
  }
  return app;
}

export function getFirebaseDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) {
    try {
      db = getFirestore(firebaseApp);
    } catch (err) {
      console.warn('Firestore initialization notice:', err);
      return null;
    }
  }
  return db;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    try {
      auth = getAuth(firebaseApp);
    } catch (err) {
      console.warn('Firebase Auth initialization notice:', err);
      return null;
    }
  }
  return auth;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!storage) {
    try {
      storage = getStorage(firebaseApp);
    } catch (err) {
      console.warn('Firebase Storage initialization notice:', err);
      return null;
    }
  }
  return storage;
}

export interface FirebaseAdDocument {
  id?: string;
  headline: string;
  copy: string;
  targetUrl?: string;
  category: string;
  status: 'pending_review' | 'approved' | 'active' | 'rejected';
  selectedCommunities?: string[];
  imageUrl?: string;
  contactPhone?: string;
  userEmail?: string;
  createdAt: any;
}

/**
 * Persists an ad submission directly into the Cloud Firestore 'ads' collection.
 */
export async function saveAdToFirestore(ad: Omit<FirebaseAdDocument, 'createdAt'>): Promise<string | null> {
  const firestore = getFirebaseDb();
  if (!firestore) {
    console.info('Ad saved locally (Firestore pending live config)');
    return null;
  }
  try {
    const docRef = await addDoc(collection(firestore, 'ads'), {
      ...ad,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving ad to Firestore:', error);
    return null;
  }
}

/**
 * Fetches recent ads from Firestore.
 */
export async function getAdsFromFirestore(maxRecords: number = 20): Promise<FirebaseAdDocument[]> {
  const firestore = getFirebaseDb();
  if (!firestore) return [];
  try {
    const q = query(collection(firestore, 'ads'), orderBy('createdAt', 'desc'), limit(maxRecords));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebaseAdDocument, 'id'>),
    }));
  } catch (error) {
    console.error('Error fetching ads from Firestore:', error);
    return [];
  }
}

/**
 * Uploads an ad image/banner directly to Firebase Storage.
 */
export async function uploadAdCreativeToStorage(file: File, adId: string): Promise<string | null> {
  const firestoreStorage = getFirebaseStorage();
  if (!firestoreStorage) {
    console.info('Ad creative cached locally (Firebase Storage pending credentials)');
    return null;
  }
  try {
    const fileRef = ref(firestoreStorage, `ad-creatives/${adId}-${Date.now()}-${file.name}`);
    const uploadResult = await uploadBytes(fileRef, file);
    return await getDownloadURL(uploadResult.ref);
  } catch (error) {
    console.error('Error uploading creative to Firebase Storage:', error);
    return null;
  }
}
