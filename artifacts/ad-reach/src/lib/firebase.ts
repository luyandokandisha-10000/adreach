import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
  type ConfirmationResult,
} from 'firebase/auth';
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

// ==========================================
// Firebase Authentication Methods
// ==========================================

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) throw new Error('Firebase Auth is not available.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
}

export async function signInWithApple(): Promise<FirebaseUser | null> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) throw new Error('Firebase Auth is not available.');
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<FirebaseUser | null> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) throw new Error('Firebase Auth is not available.');
  const result = await createUserWithEmailAndPassword(authInstance, email, password);
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName });
  }
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser | null> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) throw new Error('Firebase Auth is not available.');
  const result = await signInWithEmailAndPassword(authInstance, email, password);
  return result.user;
}

export function setupRecaptcha(containerId: string): RecaptchaVerifier | null {
  const authInstance = getFirebaseAuth();
  if (!authInstance) return null;
  try {
    return new RecaptchaVerifier(authInstance, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
    });
  } catch (e) {
    console.warn('Recaptcha initialization notice:', e);
    return null;
  }
}

export async function sendPhoneOtp(
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  const authInstance = getFirebaseAuth();
  if (!authInstance) throw new Error('Firebase Auth is not available.');
  return await signInWithPhoneNumber(authInstance, phoneNumber, verifier);
}

export async function confirmPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<FirebaseUser> {
  const result = await confirmationResult.confirm(otpCode);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  const authInstance = getFirebaseAuth();
  if (authInstance) {
    await fbSignOut(authInstance);
  }
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(authInstance, callback);
}

// ==========================================
// Cloud Firestore Data Model & Helpers
// ==========================================

export interface FirebaseAdDocument {
  id?: string;
  headline: string;
  copy: string;
  targetUrl?: string;
  category: string;
  status: 'pending' | 'approved' | 'active' | 'rejected';
  selectedCommunities?: string[];
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  contactPhone?: string;
  userEmail?: string;
  userId?: string;
  createdAt: any;
}

export async function saveAdToFirestore(ad: Omit<FirebaseAdDocument, 'createdAt'>): Promise<string | null> {
  const firestore = getFirebaseDb();
  if (!firestore) {
    console.info('Ad saved locally (Firestore pending live config)');
    return null;
  }
  try {
    const cleanDoc: Record<string, any> = {
      headline: ad.headline || '',
      copy: ad.copy || '',
      status: ad.status || 'active',
      category: ad.category || 'General Business',
      createdAt: serverTimestamp(),
    };
    if (ad.targetUrl) cleanDoc.targetUrl = ad.targetUrl;
    if (ad.imageUrl) cleanDoc.imageUrl = ad.imageUrl;
    if (ad.videoUrl) cleanDoc.videoUrl = ad.videoUrl;
    if (ad.mediaType) cleanDoc.mediaType = ad.mediaType;
    if (ad.selectedCommunities) cleanDoc.selectedCommunities = ad.selectedCommunities;
    if (ad.contactPhone) cleanDoc.contactPhone = ad.contactPhone;
    if (ad.userEmail) cleanDoc.userEmail = ad.userEmail;
    if (ad.userId) cleanDoc.userId = ad.userId;

    const docRef = await addDoc(collection(firestore, 'ads'), cleanDoc);
    return docRef.id;
  } catch (error) {
    console.error('Error saving ad to Firestore:', error);
    return null;
  }
}

export async function getAdsFromFirestore(maxRecords: number = 20): Promise<FirebaseAdDocument[]> {
  const firestore = getFirebaseDb();
  if (!firestore) return [];
  try {
    const q = query(
      collection(firestore, 'ads'),
      where('status', 'in', ['active', 'approved']),
      orderBy('createdAt', 'desc'),
      limit(maxRecords)
    );
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

// Verified subscription plans for Zambia
export const DEFAULT_ZAMBIAN_PLANS = [
  {
    id: 'weekly',
    name: 'Weekly Boost',
    price: 2000,
    amountK: 20,
    priceFormatted: 'K20 / week',
    cadence: 'weekly',
    intervalLabel: '7 days',
    adLimit: 999,
    channels: ['AdReach Facebook Network', 'Daily Deals WhatsApp Channel', 'Targeted Lusaka & Copperbelt Groups'],
    features: ['Unlimited ad broadcasts', 'All Zambian groups & communities', 'Priority WhatsApp verification', 'Targeted Lusaka & Copperbelt reach'],
  },
  {
    id: 'monthly',
    name: 'Monthly Pro',
    price: 10000,
    amountK: 100,
    priceFormatted: 'K100 / month',
    cadence: 'monthly',
    intervalLabel: '30 days',
    adLimit: 999,
    channels: ['All 12 Verified Communities', 'Featured Daily Highlights', 'VIP Zambian B2B LinkedIn Network'],
    features: ['Unlimited ad broadcasts', 'All Zambian groups & communities', 'Featured spotlight placement', 'VIP priority review under 2 hours'],
  },
];

export interface FirebasePaymentRecord {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  planId: 'weekly' | 'monthly';
  amountK: number;
  referenceCode: string;
  status: 'pending' | 'confirmed' | 'rejected';
  note?: string;
  createdAt: any;
}

export async function savePaymentToFirestore(payment: {
  userId: string;
  userEmail?: string;
  userName?: string;
  planId: 'weekly' | 'monthly';
  amountK: number;
  referenceCode: string;
}): Promise<string | null> {
  const firestore = getFirebaseDb();
  if (!firestore) return null;
  try {
    const docRef = await addDoc(collection(firestore, 'payments'), {
      userId: payment.userId,
      userEmail: payment.userEmail || '',
      userName: payment.userName || '',
      planId: payment.planId,
      amountK: payment.amountK,
      referenceCode: payment.referenceCode,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving payment to Firestore:', error);
    return null;
  }
}

export async function getAdminAdsFromFirestore(statusFilter?: string): Promise<FirebaseAdDocument[]> {
  const firestore = getFirebaseDb();
  if (!firestore) return [];
  try {
    let q = query(collection(firestore, 'ads'), orderBy('createdAt', 'desc'), limit(50));
    if (statusFilter && statusFilter !== 'all') {
      q = query(collection(firestore, 'ads'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'), limit(50));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebaseAdDocument, 'id'>),
    }));
  } catch (error) {
    console.error('Error fetching admin ads from Firestore:', error);
    return [];
  }
}

export async function updateAdStatusInFirestore(
  adId: string,
  status: 'active' | 'approved' | 'rejected',
  adminNote?: string
): Promise<boolean> {
  const firestore = getFirebaseDb();
  if (!firestore) return false;
  try {
    const adDocRef = doc(firestore, 'ads', adId);
    await updateDoc(adDocRef, {
      status,
      adminNote: adminNote || '',
      reviewedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error updating ad status:', error);
    return false;
  }
}

export async function getPaymentsFromFirestore(): Promise<FirebasePaymentRecord[]> {
  const firestore = getFirebaseDb();
  if (!firestore) return [];
  try {
    const q = query(collection(firestore, 'payments'), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebasePaymentRecord, 'id'>),
    }));
  } catch (error) {
    console.error('Error fetching payments from Firestore:', error);
    return [];
  }
}

export async function updatePaymentStatusInFirestore(
  paymentId: string,
  status: 'confirmed' | 'rejected',
  note?: string
): Promise<boolean> {
  const firestore = getFirebaseDb();
  if (!firestore) return false;
  try {
    const paymentDocRef = doc(firestore, 'payments', paymentId);
    await updateDoc(paymentDocRef, {
      status,
      reviewNote: note || '',
      reviewedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}
