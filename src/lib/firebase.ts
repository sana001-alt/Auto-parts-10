import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getAuth, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  where,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { SparePart, User, Chat, Message, SellerReview, Notification } from "../types";
import { INITIAL_SPARE_PARTS, INITIAL_SELLER_REVIEWS } from "../data/mockData";
import firebaseAppletConfig from "../../firebase-applet-config.json";

const metaEnv = (import.meta as any).env || {};

const configFromFile = (firebaseAppletConfig || {}) as any;

const getFirebaseConfigValue = (key: string, envVal: string | undefined): string => {
  const fileVal = configFromFile[key];
  if (typeof fileVal === "string" && fileVal.trim()) {
    return fileVal.trim();
  }
  if (typeof envVal === "string" && envVal.trim()) {
    let val = envVal.trim();
    if (val.includes(" ")) {
      const parts = val.split(/\s+/);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i].trim();
        if (p && !p.includes("VITE_") && !p.includes("FIREBASE_")) {
          return p;
        }
      }
      return parts[parts.length - 1].trim();
    }
    return val;
  }
  return "";
};

// Prioritize clean values from firebase-applet-config.json
const firebaseConfig = {
  apiKey: getFirebaseConfigValue("apiKey", metaEnv.VITE_FIREBASE_API_KEY) || "AIzaSyAGYut7q3nCW-qSDPSldGSbxAjnna_-bvo",
  authDomain: getFirebaseConfigValue("authDomain", metaEnv.VITE_FIREBASE_AUTH_DOMAIN) || "auto-parts-market-place-20312.firebaseapp.com",
  projectId: getFirebaseConfigValue("projectId", metaEnv.VITE_FIREBASE_PROJECT_ID) || "auto-parts-market-place-20312",
  storageBucket: getFirebaseConfigValue("storageBucket", metaEnv.VITE_FIREBASE_STORAGE_BUCKET) || "auto-parts-market-place-20312.firebasestorage.app",
  messagingSenderId: getFirebaseConfigValue("messagingSenderId", metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID) || "751764116522",
  appId: getFirebaseConfigValue("appId", metaEnv.VITE_FIREBASE_APP_ID) || "1:751764116522:web:c7eb06038e6a85337adf53",
  databaseId: getFirebaseConfigValue("firestoreDatabaseId", metaEnv.VITE_FIREBASE_DATABASE_ID) || configFromFile.firestoreDatabaseId || ""
};

// Determine if configuration is valid and fully provided
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey && 
  firebaseConfig.projectId
);

let app: any = null;
let auth: any = null;
let db: any = null;
let useFirebase = false;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = firebaseConfig.databaseId && firebaseConfig.databaseId !== "(default)"
      ? getFirestore(app, firebaseConfig.databaseId)
      : getFirestore(app);
    useFirebase = true;
    console.log("Firebase initialized successfully with configuration:", firebaseConfig.projectId, "Database:", firebaseConfig.databaseId);
  } catch (error) {
    console.error("Failed to initialize Firebase, falling back to LocalStorage:", error);
    useFirebase = false;
  }
} else {
  console.log("Firebase config not found or incomplete. Falling back to LocalStorage mode.");
}

// Ensure local storage has initial spare parts if empty
const LOCAL_STORAGE_PARTS_KEY = "autoparts_listings";
const LOCAL_STORAGE_USERS_KEY = "autoparts_users";
const LOCAL_STORAGE_CURRENT_USER_KEY = "autoparts_current_user";
const LOCAL_STORAGE_REVIEWS_KEY = "autoparts_seller_reviews";

if (!localStorage.getItem(LOCAL_STORAGE_PARTS_KEY)) {
  localStorage.setItem(LOCAL_STORAGE_PARTS_KEY, JSON.stringify([]));
}

if (!localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY)) {
  localStorage.setItem(LOCAL_STORAGE_REVIEWS_KEY, JSON.stringify([]));
}

// ----------------------------------------------------
// DATABASE SERVICES (FIRESTORE / LOCALSTORAGE)
// ----------------------------------------------------

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.warn('Firestore Access Warning: ', JSON.stringify(errInfo));
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

export async function uploadProductImage(base64Data: string, partId?: string): Promise<string> {
  try {
    const url = "https://api.cloudinary.com/v1_1/rqf1hlrx/image/upload";
    const formData = new FormData();
    formData.append("file", base64Data);
    formData.append("upload_preset", "autoparts_upload");

    const response = await withTimeout(
      fetch(url, {
        method: "POST",
        body: formData,
      }),
      15000,
      "Cloudinary upload timed out. Please check your network connection."
    );

    if (!response.ok) {
      const errText = await response.text();
      let cleanErrorMessage = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          cleanErrorMessage = parsed.error.message;
        }
      } catch (e) {}
      throw new Error(`Cloudinary error: ${cleanErrorMessage}`);
    }

    const data = await response.json();
    if (!data.secure_url) {
      throw new Error("Cloudinary response is missing secure_url.");
    }
    console.log("Image uploaded successfully to Cloudinary:", data.secure_url);
    return data.secure_url;
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    throw new Error(error.message || "Failed to upload image to Cloudinary.");
  }
}

export function extractPublicId(url: string): string | null {
  if (!url || !url.includes("cloudinary.com")) return null;
  try {
    const parts = url.split("/image/upload/");
    if (parts.length < 2) return null;
    
    let path = parts[1];
    if (path.startsWith("v")) {
      const firstSlash = path.indexOf("/");
      if (firstSlash !== -1) {
        path = path.substring(firstSlash + 1);
      }
    }
    
    const lastDot = path.lastIndexOf(".");
    if (lastDot !== -1) {
      path = path.substring(0, lastDot);
    }
    
    return path;
  } catch (e) {
    console.error("Failed to extract public_id from Cloudinary URL:", url, e);
    return null;
  }
}

export async function deleteImagesFromCloudinary(publicIds: string[]): Promise<void> {
  if (!publicIds || publicIds.length === 0) return;

  const response = await fetch("/api/delete-cloudinary-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ publicIds }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(data.error || `Server-side Cloudinary deletion API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Server-side Cloudinary deletion failed");
  }
  console.log(`Successfully deleted images from Cloudinary via backend:`, publicIds);
}

export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  await deleteImagesFromCloudinary([publicId]);
}

export function isUsingFirebase(): boolean {
  return useFirebase;
}

export function convertTimestampToNumber(timestamp: any): number {
  if (!timestamp) return Date.now();
  if (typeof timestamp === "number") return timestamp;
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
  return Date.now();
}

export async function fetchSpareParts(): Promise<SparePart[]> {
  if (useFirebase && db) {
    const path = "products/listings/items";
    try {
      const partsRef = collection(db, "products", "listings", "items");
      const q = query(partsRef);
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log("Firestore products collection is empty.");
        return [];
      }

      const parts: SparePart[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        parts.push({ 
          ...data, 
          id: docSnapshot.id,
          createdAt: convertTimestampToNumber(data.createdAt)
        } as SparePart);
      });
      
      // Sort client-side to ensure ordering is correct and stable without requiring an index
      parts.sort((a, b) => b.createdAt - a.createdAt);
      return parts;
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.GET, path);
      } else {
        console.warn("Firestore fetch issue, falling back to LocalStorage:", err);
      }
    }
  }

  // Fallback to LocalStorage
  const localData = localStorage.getItem(LOCAL_STORAGE_PARTS_KEY);
  if (localData) {
    const parts: SparePart[] = JSON.parse(localData);
    // sort by newest
    return parts.sort((a, b) => b.createdAt - a.createdAt);
  }
  return [];
}

export async function createSparePartListing(part: Omit<SparePart, "id" | "createdAt">): Promise<SparePart> {
  if (useFirebase && db) {
    const path = "products/listings/items";
    try {
      if (!auth) {
        throw new Error("Firebase Auth is not initialized.");
      }
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You must be logged in to create a listing.");
      }

      // Generate a temporary ID for file upload naming if needed
      const tempId = "part-" + Math.random().toString(36).substr(2, 9);
      let finalImageUrl = part.imageUrl;
      if (part.imageUrl && part.imageUrl.startsWith("data:image/")) {
        finalImageUrl = await uploadProductImage(part.imageUrl, tempId);
      }

      // Construct a clean payload for Firestore without an empty id field
      const publicIds: string[] = [];
      const urlsToProcess = [finalImageUrl, ...(part.imageUrls || [])];
      for (const url of urlsToProcess) {
        if (url) {
          const pid = extractPublicId(url);
          if (pid && !publicIds.includes(pid)) {
            publicIds.push(pid);
          }
        }
      }

      const payload = {
        title: part.title,
        description: part.description,
        price: part.price,
        carBrand: part.carBrand,
        carModel: part.carModel,
        category: part.category,
        partName: part.partName || "",
        condition: part.condition,
        location: part.location,
        state: part.state || "",
        district: part.district || "",
        lat: part.lat ?? null,
        lng: part.lng ?? null,
        contactName: part.contactName,
        contactPhone: part.contactPhone,
        whatsappPhone: part.whatsappPhone || "",
        imageUrl: finalImageUrl,
        imageUrls: part.imageUrls || [finalImageUrl],
        imagePublicIds: publicIds,
        sellerId: currentUser.uid, // Explicitly set to current authenticated user ID
        sellerEmail: currentUser.email || part.sellerEmail,
        sold: part.sold || false,
        createdAt: serverTimestamp()
      };

      const partsRef = collection(db, "products", "listings", "items");
      console.log(`[Firestore Write] Creating new listing in products/listings/items...`);
      const docRef = await withTimeout(
        addDoc(partsRef, payload),
        10000,
        "Firestore listing creation timed out. Please check your database connection or try again."
      );
      
      const exactPath = `products/listings/items/${docRef.id}`;
      console.log(`[Firestore Write] Listing created successfully in Firestore. Document ID: ${docRef.id}, exact Firestore path: ${exactPath}`);

      // Immediately fetch and verify the document exists in Firestore
      const savedDoc = await withTimeout(
        getDoc(docRef),
        10000,
        "Firestore verification timed out. Failed to confirm listing creation."
      );
      if (!savedDoc.exists()) {
        throw new Error(`Failed to verify listing after creation in Firestore. Document at path "${exactPath}" does not exist.`);
      }

      const savedData = savedDoc.data();
      console.log(`[Firestore Readback Verification] Verified document exists at ${exactPath}. ID: ${docRef.id}`);
      return {
        ...savedData,
        id: docRef.id,
        createdAt: convertTimestampToNumber(savedData.createdAt)
      } as SparePart;
    } catch (err: any) {
      console.error(`[Firestore Write Failure] Error during listing creation/verification at products/listings/items:`, err);
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      // CRITICAL: We MUST throw the complete error here so that the UI can capture and display it!
      throw new Error(`Firestore listing creation failed: ${err.message || err}`);
    }
  }

  // Fallback / standard LocalStorage save if Firebase is disabled
  const tempId = "part-" + Math.random().toString(36).substr(2, 9);
  const localPids: string[] = [];
  const localUrls = [part.imageUrl, ...(part.imageUrls || [])];
  for (const url of localUrls) {
    if (url) {
      const pid = extractPublicId(url);
      if (pid && !localPids.includes(pid)) {
        localPids.push(pid);
      }
    }
  }

  const newPart: SparePart = {
    ...part,
    imagePublicIds: localPids,
    id: "local-part-" + tempId,
    createdAt: Date.now()
  };
  const localData = localStorage.getItem(LOCAL_STORAGE_PARTS_KEY);
  const partsList: SparePart[] = localData ? JSON.parse(localData) : [];
  partsList.unshift(newPart);
  localStorage.setItem(LOCAL_STORAGE_PARTS_KEY, JSON.stringify(partsList));
  window.dispatchEvent(new Event("autoparts_listings_updated"));
  return newPart;
}

export function subscribeToSpareParts(
  callback: (parts: SparePart[]) => void,
  onError?: (err: Error) => void
): () => void {
  console.log(`[Firestore Listener] subscribeToSpareParts requested...`);
  if (useFirebase && db) {
    try {
      const partsRef = collection(db, "products", "listings", "items");
      const q = query(partsRef);

      const unsub = onSnapshot(q, (snapshot) => {
        console.log(`[Firestore Listener Callback] Received parts snapshot update. Size: ${snapshot.size}`);
        
        if (snapshot.empty) {
          console.log("Firestore products collection is empty in listener.");
          callback([]);
          return;
        }

        const parts: SparePart[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          parts.push({
            ...data,
            id: docSnapshot.id,
            createdAt: convertTimestampToNumber(data.createdAt)
          } as SparePart);
        });
        
        // Sort client-side to ensure ordering is correct and stable without requiring an index
        parts.sort((a, b) => b.createdAt - a.createdAt);
        callback(parts);
      }, (err) => {
        console.error(`[Firestore Listener Error] subscribeToSpareParts failed:`, err);
        if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
          handleFirestoreError(err, OperationType.LIST, "products/listings/items");
        }
        if (onError) onError(err);
      });

      return unsub;
    } catch (err: any) {
      console.error(`[Firestore Query Exception] Error starting parts listener:`, err);
      if (onError) onError(err);
      return () => {};
    }
  }

  // Fallback / standard LocalStorage fallback with simulated event or interval
  console.log(`[LocalStorage Fallback] Using localStorage listener for parts.`);
  const loadLocalParts = () => {
    const localData = localStorage.getItem(LOCAL_STORAGE_PARTS_KEY);
    if (localData) {
      const partsList: SparePart[] = JSON.parse(localData);
      callback(partsList.sort((a, b) => b.createdAt - a.createdAt));
    } else {
      callback([]);
    }
  };

  loadLocalParts();

  // Listen to custom events or simple storage event for local updates
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_PARTS_KEY) {
      loadLocalParts();
    }
  };
  
  const handleCustomUpdate = () => {
    loadLocalParts();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener("autoparts_listings_updated", handleCustomUpdate);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener("autoparts_listings_updated", handleCustomUpdate);
  };
}

export async function deleteSparePartListing(partId: string): Promise<boolean> {
  if (useFirebase && db && !partId.startsWith("local-part-")) {
    const path = `products/listings/items/${partId}`;
    try {
      const docRef = doc(db, "products", "listings", "items", partId);
      
      // Fetch the document first to retrieve Cloudinary public IDs
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const pids = data.imagePublicIds || [];
        
        // Also extract from imageUrl and imageUrls for backward compatibility and safety
        const extractedPids: string[] = [];
        const urls = [data.imageUrl, ...(data.imageUrls || [])];
        for (const url of urls) {
          if (url) {
            const pid = extractPublicId(url);
            if (pid && !extractedPids.includes(pid) && !pids.includes(pid)) {
              extractedPids.push(pid);
            }
          }
        }
        
        const allPids = [...pids, ...extractedPids];
        if (allPids.length > 0) {
          try {
            await deleteImagesFromCloudinary(allPids);
          } catch (err: any) {
            console.error(`Failed to clean up Cloudinary images:`, err);
            throw new Error(`Cloudinary cleanup failed: ${err.message || String(err)}. Listing was not deleted from Firestore.`);
          }
        }
      }
      
      await deleteDoc(docRef);
      return true;
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.DELETE, path);
        throw err;
      } else {
        console.warn("Firestore delete issue:", err);
        throw err;
      }
    }
  }

  // LocalStorage delete fallback
  const localData = localStorage.getItem(LOCAL_STORAGE_PARTS_KEY);
  if (localData) {
    let partsList: SparePart[] = JSON.parse(localData);
    partsList = partsList.filter(p => p.id !== partId);
    localStorage.setItem(LOCAL_STORAGE_PARTS_KEY, JSON.stringify(partsList));
    return true;
  }
  return false;
}

export async function updateSparePartListing(partId: string, updates: Partial<SparePart>): Promise<boolean> {
  if (useFirebase && db && !partId.startsWith("local-part-")) {
    const path = `products/listings/items/${partId}`;
    try {
      const docRef = doc(db, "products", "listings", "items", partId);
      
      // If imageUrl or imageUrls are updated, compute new public IDs and clean up orphaned ones
      if (updates.imageUrl || updates.imageUrls) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const oldData = docSnap.data();
          const oldPids = oldData.imagePublicIds || [];
          
          // Compute new public IDs
          const newUrls = [updates.imageUrl || oldData.imageUrl, ...(updates.imageUrls || oldData.imageUrls || [])];
          const newPids: string[] = [];
          for (const url of newUrls) {
            if (url) {
              const pid = extractPublicId(url);
              if (pid && !newPids.includes(pid)) {
                newPids.push(pid);
              }
            }
          }
          updates.imagePublicIds = newPids;

          // Find old public IDs that are no longer in new public IDs (orphaned)
          const orphanedPids = oldPids.filter((pid: string) => !newPids.includes(pid));
          for (const pid of orphanedPids) {
            try {
              await deleteImageFromCloudinary(pid);
            } catch (err) {
              console.warn(`Failed to clean up orphaned image ${pid} during update:`, err);
            }
          }
        }
      }

      await updateDoc(docRef, updates);
      return true;
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.UPDATE, path);
        throw err;
      } else {
        console.warn("Firestore update issue:", err);
        throw err;
      }
    }
  }

  // LocalStorage update fallback
  const localData = localStorage.getItem(LOCAL_STORAGE_PARTS_KEY);
  if (localData) {
    let partsList: SparePart[] = JSON.parse(localData);
    partsList = partsList.map(p => p.id === partId ? { ...p, ...updates } : p);
    localStorage.setItem(LOCAL_STORAGE_PARTS_KEY, JSON.stringify(partsList));
    return true;
  }
  return false;
}

// ----------------------------------------------------
// AUTHENTICATION SERVICES (FIREBASE AUTH / LOCALSTORAGE)
// ----------------------------------------------------

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Active callbacks for local auth updates
const authCallbacks = new Set<(user: User | null) => void>();

function dispatchAuthChange() {
  const localUserRaw = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_KEY);
  let currentUser: User | null = null;
  if (localUserRaw) {
    try {
      currentUser = JSON.parse(localUserRaw);
    } catch (e) {}
  }
  for (const cb of authCallbacks) {
    cb(currentUser);
  }
  window.dispatchEvent(new Event("autoparts_auth_changed"));
  window.dispatchEvent(new Event("storage"));
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  authCallbacks.add(callback);
  
  let unsubscribeFirebase: (() => void) | null = null;
  
  if (useFirebase && auth) {
    try {
      unsubscribeFirebase = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          // Resolve user display details
          const u: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            phone: firebaseUser.phoneNumber || undefined,
            emailVerified: firebaseUser.emailVerified,
          };
          
          try {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              u.name = data.name || u.name;
              u.phone = data.phone || u.phone;
              u.state = data.state || u.state;
              u.district = data.district || u.district;
            }
          } catch (e: any) {
            if (e?.code === "permission-denied" || e?.message?.includes("permission") || e?.message?.includes("Missing or insufficient permissions")) {
              handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
            } else {
              console.warn("Failed to load user profile from Firestore:", e);
            }
          }
          // Save locally so fallback is in sync
          localStorage.setItem(LOCAL_STORAGE_CURRENT_USER_KEY, JSON.stringify(u));
          callback(u);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
          callback(null);
        }
      });
    } catch (e) {
      console.warn("Firebase onAuthStateChanged failed:", e);
    }
  } else {
    localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
    callback(null);
  }

  // Handle storage / custom event for dynamic local auth changes
  const handleLocalAuthChange = () => {
    const localUserRaw = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_KEY);
    if (localUserRaw) {
      try {
        callback(JSON.parse(localUserRaw));
      } catch (e) {
        callback(null);
      }
    } else {
      callback(null);
    }
  };

  window.addEventListener("autoparts_auth_changed", handleLocalAuthChange);
  window.addEventListener("storage", handleLocalAuthChange);

  return () => {
    authCallbacks.delete(callback);
    if (unsubscribeFirebase) {
      unsubscribeFirebase();
    }
    window.removeEventListener("autoparts_auth_changed", handleLocalAuthChange);
    window.removeEventListener("storage", handleLocalAuthChange);
  };
}

export async function updateUserProfile(userId: string, profile: Partial<User>): Promise<void> {
  if (useFirebase && db) {
    try {
      const userDocRef = doc(db, "users", userId);
      await setDoc(userDocRef, {
        ...profile,
        id: userId,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e: any) {
      if (e?.code === "permission-denied" || e?.message?.includes("permission") || e?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(e, OperationType.WRITE, `users/${userId}`);
      } else {
        console.warn("Failed to update user profile in Firestore:", e);
      }
    }
  }

  // Also update in LocalStorage CURRENT_USER
  const currentRaw = localStorage.getItem(LOCAL_STORAGE_CURRENT_USER_KEY);
  if (currentRaw) {
    try {
      const current: User = JSON.parse(currentRaw);
      if (current.id === userId) {
        const updated = { ...current, ...profile };
        localStorage.setItem(LOCAL_STORAGE_CURRENT_USER_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Failed to parse local current user profile:", e);
    }
  }

  dispatchAuthChange();
}

export async function signInWithGoogle(): Promise<User> {
  if (useFirebase && auth) {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      const u: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        phone: firebaseUser.phoneNumber || undefined,
        emailVerified: firebaseUser.emailVerified,
      };

      if (db) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              id: firebaseUser.uid,
              name: u.name,
              email: u.email,
              phone: u.phone,
              createdAt: Date.now()
            });
          } else {
            const data = userDoc.data();
            u.name = data.name || u.name;
            u.phone = data.phone || u.phone;
            u.state = data.state || u.state;
            u.district = data.district || u.district;
          }
        } catch (e: any) {
          if (e?.code === "permission-denied" || e?.message?.includes("permission") || e?.message?.includes("Missing or insufficient permissions")) {
            handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
          } else {
            console.warn("Failed to check or create user document in Firestore on Google Login:", e);
          }
        }
      }

      localStorage.setItem(LOCAL_STORAGE_CURRENT_USER_KEY, JSON.stringify(u));
      dispatchAuthChange();
      return u;
    } catch (err: any) {
      throw err;
    }
  }

  // Fallback / mock Google Sign-In for development/offline
  const mockUser: User = {
    id: "google-mock-user-123",
    email: "googleuser@example.com",
    name: "Google User",
    emailVerified: true
  };
  localStorage.setItem(LOCAL_STORAGE_CURRENT_USER_KEY, JSON.stringify(mockUser));
  dispatchAuthChange();
  return mockUser;
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(LOCAL_STORAGE_CURRENT_USER_KEY);
  dispatchAuthChange();

  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn("Firebase signOut failed:", e);
    }
  }
}

// Unused Email-based auth functions removed

// ----------------------------------------------------
// IN-APP CHAT SERVICES (FIRESTORE / LOCALSTORAGE FALLBACK)
// ----------------------------------------------------

const LOCAL_STORAGE_CHATS_KEY = "autoparts_chats_list";

export async function fetchUserChats(userId: string): Promise<Chat[]> {
  if (useFirebase && db) {
    try {
      const chatsRef = collection(db, "chats");
      
      // Query as buyer
      const qBuyer = query(chatsRef, where("buyerId", "==", userId));
      const buyerSnap = await getDocs(qBuyer);
      
      // Query as seller
      const qSeller = query(chatsRef, where("sellerId", "==", userId));
      const sellerSnap = await getDocs(qSeller);
      
      const chatsMap = new Map<string, Chat>();
      
      buyerSnap.forEach((d) => {
        chatsMap.set(d.id, { id: d.id, ...d.data() } as Chat);
      });
      
      sellerSnap.forEach((d) => {
        chatsMap.set(d.id, { id: d.id, ...d.data() } as Chat);
      });
      
      return Array.from(chatsMap.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.LIST, "chats");
      } else {
        console.warn("Firestore chats fetch failed:", err);
      }
    }
  }

  // LocalStorage Mock
  const localChatsRaw = localStorage.getItem(LOCAL_STORAGE_CHATS_KEY);
  if (localChatsRaw) {
    const chats: Chat[] = JSON.parse(localChatsRaw);
    return chats
      .filter((c) => c.buyerId === userId || c.sellerId === userId)
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }
  return [];
}

export function subscribeToUserChats(
  userId: string,
  callback: (chats: Chat[]) => void,
  onError?: (err: Error) => void
): () => void {
  console.log(`[Firestore Query/Listener] subscribeToUserChats requested for userId: "${userId}"`);

  if (useFirebase && auth && db) {
    let unsubBuyer: (() => void) | null = null;
    let unsubSeller: (() => void) | null = null;
    let isUnsubscribed = false;

    // Helper to start the actual Firestore listeners
    const startListeners = (authenticatedUid: string) => {
      if (isUnsubscribed) return;
      
      try {
        console.log(`[Firestore Query] Starting chats queries for authenticated user "${authenticatedUid}"...`);
        const chatsRef = collection(db, "chats");
        const qBuyer = query(chatsRef, where("buyerId", "==", authenticatedUid));
        const qSeller = query(chatsRef, where("sellerId", "==", authenticatedUid));
        
        let buyerChats: Chat[] = [];
        let sellerChats: Chat[] = [];
        let buyerLoaded = false;
        let sellerLoaded = false;
        let buyerError: any = null;
        let sellerError: any = null;
        
        const emit = () => {
          if (isUnsubscribed) return;
          
          if (buyerError || sellerError) {
            const error = buyerError || sellerError;
            console.error(`[Firestore Listener Error] subscribeToUserChats error:`, error);
            if (onError) {
              onError(error instanceof Error ? error : new Error(String(error)));
            } else {
              callback([]);
            }
            return;
          }

          if (buyerLoaded && sellerLoaded) {
            const chatsMap = new Map<string, Chat>();
            buyerChats.forEach(c => chatsMap.set(c.id, c));
            sellerChats.forEach(c => chatsMap.set(c.id, c));
            const sorted = Array.from(chatsMap.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
            console.log(`[Firestore Query] subscribeToUserChats successfully emitted ${sorted.length} chats.`);
            callback(sorted);
          }
        };
        
        console.log(`[Firestore Listener] Subscribing to buyer chats (buyerId == "${authenticatedUid}")...`);
        unsubBuyer = onSnapshot(qBuyer, (snapshot) => {
          console.log(`[Firestore Listener Callback] Received buyer chats update. Document count: ${snapshot.size}`);
          buyerChats = [];
          snapshot.forEach((d) => {
            buyerChats.push({ id: d.id, ...d.data() } as Chat);
          });
          buyerLoaded = true;
          buyerError = null;
          emit();
        }, (err) => {
          console.error(`[Firestore Listener Error] Failed on qBuyer snapshot subscription:`, err);
          handleFirestoreError(err, OperationType.LIST, `chats (buyerId == ${authenticatedUid})`);
          buyerLoaded = true;
          buyerError = err;
          emit();
        });
        
        console.log(`[Firestore Listener] Subscribing to seller chats (sellerId == "${authenticatedUid}")...`);
        unsubSeller = onSnapshot(qSeller, (snapshot) => {
          console.log(`[Firestore Listener Callback] Received seller chats update. Document count: ${snapshot.size}`);
          sellerChats = [];
          snapshot.forEach((d) => {
            sellerChats.push({ id: d.id, ...d.data() } as Chat);
          });
          sellerLoaded = true;
          sellerError = null;
          emit();
        }, (err) => {
          console.error(`[Firestore Listener Error] Failed on qSeller snapshot subscription:`, err);
          handleFirestoreError(err, OperationType.LIST, `chats (sellerId == ${authenticatedUid})`);
          sellerLoaded = true;
          sellerError = err;
          emit();
        });
      } catch (err: any) {
        console.error("[Firestore Query Exception] Error inside subscribeToUserChats startListeners:", err);
        if (onError) {
          onError(err);
        } else {
          callback([]);
        }
      }
    };

    // Listen to Auth State changes to ensure we have a valid, non-null Firebase user UID
    console.log(`[Firestore Auth Watch] Registering onAuthStateChanged listener to delay query until user is authenticated.`);
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (isUnsubscribed) return;

      if (firebaseUser) {
        console.log(`[Firestore Auth Watch] User is authenticated with UID: "${firebaseUser.uid}". Starting chat listeners.`);
        // Stop any old listeners just in case
        if (unsubBuyer) { unsubBuyer(); unsubBuyer = null; }
        if (unsubSeller) { unsubSeller(); unsubSeller = null; }
        
        startListeners(firebaseUser.uid);
      } else {
        console.warn(`[Firestore Auth Watch] User is NOT authenticated in Firebase. Delaying chat queries.`);
        if (unsubBuyer) { unsubBuyer(); unsubBuyer = null; }
        if (unsubSeller) { unsubSeller(); unsubSeller = null; }
        // For security, if they are not authenticated, we return empty list and stop loader
        callback([]);
      }
    });

    return () => {
      console.log(`[Firestore Listener Cleanup] Cleaning up subscribeToUserChats wrapper for user "${userId}".`);
      isUnsubscribed = true;
      unsubAuth();
      if (unsubBuyer) unsubBuyer();
      if (unsubSeller) unsubSeller();
    };
  }
  
  // LocalStorage Fallback
  console.log(`[LocalStorage Fallback] Initiating subscribeToUserChats for user "${userId}"`);
  const loadLocal = () => {
    try {
      const localChatsRaw = localStorage.getItem(LOCAL_STORAGE_CHATS_KEY);
      if (localChatsRaw) {
        const chats: Chat[] = JSON.parse(localChatsRaw);
        const filtered = chats
          .filter((c) => c.buyerId === userId || c.sellerId === userId)
          .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        callback(filtered);
      } else {
        callback([]);
      }
    } catch (err: any) {
      console.error("[LocalStorage Error] Failed to read or parse local chats:", err);
      if (onError) onError(err);
      else callback([]);
    }
  };
  
  loadLocal();
  const handleUpdate = () => {
    loadLocal();
  };
  
  window.addEventListener("autoparts_chat_updated", handleUpdate);
  window.addEventListener("storage", handleUpdate);
  
  return () => {
    console.log(`[LocalStorage Cleanup] Unsubscribing from LocalStorage events for user "${userId}".`);
    window.removeEventListener("autoparts_chat_updated", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export async function fetchChatMessages(chatId: string): Promise<Message[]> {
  console.log(`[Firestore Query] fetchChatMessages requested for chatId: "${chatId}"`);
  if (useFirebase && db) {
    try {
      const msgRef = collection(db, "chats", chatId, "messages");
      const q = query(msgRef, orderBy("createdAt", "asc"));
      console.log(`[Firestore Query] Running getDocs query on chats/${chatId}/messages...`);
      const snapshot = await getDocs(q);
      console.log(`[Firestore Query] fetchChatMessages completed for "${chatId}". Retried size: ${snapshot.size}`);
      const messages: Message[] = [];
      snapshot.forEach((d) => {
        messages.push({ id: d.id, ...d.data() } as Message);
      });
      return messages;
    } catch (err: any) {
      console.error(`[Firestore Query Error] fetchChatMessages failed for "${chatId}":`, err);
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages`);
      } else {
        console.warn("Firestore message fetch failed:", err);
      }
      throw err;
    }
  }

  // LocalStorage Mock
  console.log(`[LocalStorage Fallback] fetchChatMessages for "${chatId}"`);
  try {
    const localMsgKey = `autoparts_chat_messages_${chatId}`;
    const localMsgRaw = localStorage.getItem(localMsgKey);
    return localMsgRaw ? JSON.parse(localMsgRaw) : [];
  } catch (err: any) {
    console.error("[LocalStorage Error] Failed to fetch local messages:", err);
    return [];
  }
}

export function subscribeToChatMessages(
  chatId: string,
  callback: (messages: Message[]) => void,
  onError?: (err: Error) => void
): () => void {
  console.log(`[Firestore Query/Listener] subscribeToChatMessages requested for chatId: "${chatId}"`);
  
  if (useFirebase && auth && db) {
    let unsubMessages: (() => void) | null = null;
    let isUnsubscribed = false;

    const startMessagesListener = (authenticatedUid: string) => {
      if (isUnsubscribed) return;
      try {
        const msgRef = collection(db, "chats", chatId, "messages");
        const q = query(msgRef, orderBy("createdAt", "asc"));
        console.log(`[Firestore Listener] Subscribing to messages in subcollection: chats/${chatId}/messages for authenticated UID: ${authenticatedUid}`);
        unsubMessages = onSnapshot(q, (snapshot) => {
          console.log(`[Firestore Listener Callback] Received messages snapshot update for chatId: "${chatId}". Size: ${snapshot.size}`);
          const messages: Message[] = [];
          snapshot.forEach((d) => {
            messages.push({ id: d.id, ...d.data() } as Message);
          });
          callback(messages);
        }, (err) => {
          console.error(`[Firestore Listener Error] subscribeToChatMessages onSnapshot failed for chatId: "${chatId}":`, err);
          if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
            handleFirestoreError(err, OperationType.GET, `chats/${chatId}/messages`);
          } else {
            console.warn("Firestore messages subscription error:", err);
          }
          if (onError) onError(err);
        });
      } catch (err: any) {
        console.error(`[Firestore Query Exception] Error starting messages listener for chatId: "${chatId}":`, err);
        if (onError) onError(err);
      }
    };

    console.log(`[Firestore Auth Watch] Registering onAuthStateChanged listener to delay message query until user is authenticated.`);
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (isUnsubscribed) return;
      if (firebaseUser) {
        console.log(`[Firestore Auth Watch] User is authenticated: "${firebaseUser.uid}". Starting messages listener for chatId: "${chatId}".`);
        if (unsubMessages) { unsubMessages(); unsubMessages = null; }
        startMessagesListener(firebaseUser.uid);
      } else {
        console.warn(`[Firestore Auth Watch] User is NOT authenticated. Delaying message query for chatId: "${chatId}".`);
        if (unsubMessages) { unsubMessages(); unsubMessages = null; }
        callback([]);
      }
    });

    return () => {
      console.log(`[Firestore Listener Cleanup] Cleaning up subscribeToChatMessages for chatId: "${chatId}".`);
      isUnsubscribed = true;
      unsubAuth();
      if (unsubMessages) unsubMessages();
    };
  }

  // LocalStorage Mock with Custom Event and polling fallback
  console.log(`[LocalStorage Fallback] subscribeToChatMessages for chatId: "${chatId}"`);
  const getLocalMessages = () => {
    try {
      const localMsgKey = `autoparts_chat_messages_${chatId}`;
      const localMsgRaw = localStorage.getItem(localMsgKey);
      callback(localMsgRaw ? JSON.parse(localMsgRaw) : []);
    } catch (err: any) {
      console.error("[LocalStorage Error] Failed to read or parse local messages:", err);
      if (onError) onError(err);
    }
  };

  // Run once immediately
  getLocalMessages();

  // Listen to custom updates inside the app simulator
  const handleUpdate = () => {
    getLocalMessages();
  };

  window.addEventListener("autoparts_chat_updated", handleUpdate);
  window.addEventListener("storage", handleUpdate);
  
  return () => {
    console.log(`[LocalStorage Cleanup] Removing messages storage listeners for chatId: "${chatId}".`);
    window.removeEventListener("autoparts_chat_updated", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export async function sendChatMessage(
  chatId: string, 
  senderId: string, 
  text: string, 
  chatMeta?: Omit<Chat, "id" | "lastMessageText" | "lastMessageAt">
): Promise<Message> {
  const timestamp = Date.now();
  const newMessageId = "msg-" + Math.random().toString(36).substr(2, 9);
  
  const newMessage: Omit<Message, "id"> = {
    senderId,
    text,
    createdAt: timestamp
  };

  if (useFirebase && db) {
    try {
      const chatDocRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatDocRef);
      
      // If chat document does not exist, initialize it with metadata
      if (!chatDoc.exists()) {
        if (!chatMeta) {
          throw new Error("Chat metadata is required to initialize a new conversation document");
        }
        await setDoc(chatDocRef, {
          ...chatMeta,
          lastMessageText: text,
          lastMessageAt: timestamp,
          lastSenderId: senderId
        });
      } else {
        await updateDoc(chatDocRef, {
          lastMessageText: text,
          lastMessageAt: timestamp,
          lastSenderId: senderId
        });
      }
      
      // Add message
      const msgCollectionRef = collection(db, "chats", chatId, "messages");
      const addedDoc = await addDoc(msgCollectionRef, newMessage);
      
      // Create/update unread notification in Firestore for the receiver only (overwrites to avoid duplicates)
      try {
        const finalChatData = chatDoc.exists() ? chatDoc.data() : chatMeta;
        if (finalChatData) {
          const recipientId = senderId === finalChatData.buyerId ? finalChatData.sellerId : finalChatData.buyerId;
          const notificationId = `${chatId}_${recipientId}`;
          const notificationDocRef = doc(db, "notifications", notificationId);
          
          await setDoc(notificationDocRef, {
            id: notificationId,
            chatId,
            recipientId,
            senderId,
            text,
            createdAt: timestamp,
            read: false,
            partTitle: finalChatData.partTitle || "",
            partPrice: finalChatData.partPrice || 0,
            partImageUrl: finalChatData.partImageUrl || "",
            buyerId: finalChatData.buyerId,
            buyerName: finalChatData.buyerName,
            sellerId: finalChatData.sellerId,
            sellerName: finalChatData.sellerName
          }, { merge: true });
          console.log(`[Firestore Notification] Created/Updated notification ${notificationId} for recipient ${recipientId}`);
        }
      } catch (notifErr) {
        console.warn("Failed to create Firestore notification:", notifErr);
      }
      
      return { id: addedDoc.id, ...newMessage };
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}`);
      } else {
        console.warn("Firestore message send error, falling back to LocalStorage:", err);
      }
    }
  }

  // LocalStorage Mock
  // 1. Update/Create Chat Room
  const localChatsRaw = localStorage.getItem(LOCAL_STORAGE_CHATS_KEY);
  const chatsList: Chat[] = localChatsRaw ? JSON.parse(localChatsRaw) : [];
  let existingChat = chatsList.find((c) => c.id === chatId);
  
  if (!existingChat) {
    if (!chatMeta) {
      throw new Error("Chat metadata is required to initialize a new conversation");
    }
    existingChat = {
      ...chatMeta,
      id: chatId,
      lastMessageText: text,
      lastMessageAt: timestamp,
      lastSenderId: senderId
    };
    chatsList.push(existingChat);
  } else {
    existingChat.lastMessageText = text;
    existingChat.lastMessageAt = timestamp;
    existingChat.lastSenderId = senderId;
  }
  localStorage.setItem(LOCAL_STORAGE_CHATS_KEY, JSON.stringify(chatsList));

  // 2. Append Message
  const localMsgKey = `autoparts_chat_messages_${chatId}`;
  const localMsgRaw = localStorage.getItem(localMsgKey);
  const messages: Message[] = localMsgRaw ? JSON.parse(localMsgRaw) : [];
  
  const fullMessage: Message = { id: newMessageId, ...newMessage };
  messages.push(fullMessage);
  localStorage.setItem(localMsgKey, JSON.stringify(messages));

  // Create or update unread notification in LocalStorage (overwrites to avoid duplicates)
  try {
    const finalChatMeta = existingChat || chatMeta;
    if (finalChatMeta) {
      const recipientId = senderId === finalChatMeta.buyerId ? finalChatMeta.sellerId : finalChatMeta.buyerId;
      const notificationId = `${chatId}_${recipientId}`;
      
      const localNotificationsRaw = localStorage.getItem("autoparts_notifications");
      let localNotifications: any[] = [];
      if (localNotificationsRaw) {
        try {
          localNotifications = JSON.parse(localNotificationsRaw);
        } catch (e) {}
      }
      
      // Filter out existing unread notification for the same chat/recipient to prevent duplicates
      localNotifications = localNotifications.filter(n => n.id !== notificationId);
      
      localNotifications.push({
        id: notificationId,
        chatId,
        recipientId,
        senderId,
        text,
        createdAt: timestamp,
        read: false,
        partTitle: finalChatMeta.partTitle || "",
        partPrice: finalChatMeta.partPrice || 0,
        partImageUrl: finalChatMeta.partImageUrl || "",
        buyerId: finalChatMeta.buyerId,
        buyerName: finalChatMeta.buyerName,
        sellerId: finalChatMeta.sellerId,
        sellerName: finalChatMeta.sellerName
      });
      
      localStorage.setItem("autoparts_notifications", JSON.stringify(localNotifications));
      window.dispatchEvent(new Event("autoparts_notifications_updated"));
    }
  } catch (notifErr) {
    console.warn("Failed to create LocalStorage notification:", notifErr);
  }

  // Dispatch custom events to refresh any active chat drawers in real-time
  window.dispatchEvent(new CustomEvent("autoparts_chat_updated", { detail: { chatId } }));
  window.dispatchEvent(new Event("storage"));
  
  return fullMessage;
}

export async function getOrCreateChat(part: SparePart, buyer: User): Promise<Chat> {
  const chatId = `${buyer.id}_${part.sellerId}_${part.id}`;
  
  if (useFirebase && db) {
    try {
      const chatDocRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatDocRef);
      
      if (chatDoc.exists()) {
        return { id: chatDoc.id, ...chatDoc.data() } as Chat;
      }
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.GET, `chats/${chatId}`);
      } else {
        console.warn("Firestore getOrCreateChat check failed:", err);
      }
    }
  }

  // LocalStorage Mock check
  const localChatsRaw = localStorage.getItem(LOCAL_STORAGE_CHATS_KEY);
  const chatsList: Chat[] = localChatsRaw ? JSON.parse(localChatsRaw) : [];
  const foundChat = chatsList.find((c) => c.id === chatId);
  
  if (foundChat) {
    return foundChat;
  }

  // Return non-existing metadata with computed ID. Sending a message will automatically persist it.
  return {
    id: chatId,
    partId: part.id,
    partTitle: part.title,
    partImageUrl: part.imageUrl,
    partPrice: part.price,
    buyerId: buyer.id,
    buyerName: buyer.name,
    sellerId: part.sellerId,
    sellerName: part.contactName,
    lastMessageText: "",
    lastMessageAt: Date.now()
  };
}

// ----------------------------------------------------
// SELLER RATING & REVIEWS SERVICES
// ----------------------------------------------------

export async function fetchSellerReviews(sellerId: string): Promise<SellerReview[]> {
  if (useFirebase && db) {
    try {
      const reviewsRef = collection(db, "seller_reviews");
      const q = query(reviewsRef, where("sellerId", "==", sellerId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Let's seed mock reviews for this sellerId if any exist in INITIAL_SELLER_REVIEWS
        const sellerMockReviews = INITIAL_SELLER_REVIEWS.filter((r) => r.sellerId === sellerId);
        if (sellerMockReviews.length > 0) {
          console.log(`Seeding Firestore reviews for seller: ${sellerId}`);
          for (const item of sellerMockReviews) {
            const { id, ...reviewData } = item;
            await addDoc(reviewsRef, { ...reviewData, createdAt: Date.now() });
          }
          // fetch again
          const retrySnapshot = await getDocs(q);
          const retryReviews: SellerReview[] = [];
          retrySnapshot.forEach((docSnapshot) => {
            retryReviews.push({ id: docSnapshot.id, ...docSnapshot.data() } as SellerReview);
          });
          return retryReviews.sort((a, b) => b.createdAt - a.createdAt);
        }
      }

      const reviews: SellerReview[] = [];
      snapshot.forEach((docSnapshot) => {
        reviews.push({ id: docSnapshot.id, ...docSnapshot.data() } as SellerReview);
      });
      return reviews.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.LIST, "seller_reviews");
      } else {
        console.warn("Firestore reviews fetch error, falling back to LocalStorage", err);
      }
    }
  }

  // Fallback to LocalStorage
  const localData = localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY);
  if (localData) {
    const reviews: SellerReview[] = JSON.parse(localData);
    return reviews
      .filter((r) => r.sellerId === sellerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return [];
}

export async function createSellerReview(review: Omit<SellerReview, "id" | "createdAt">): Promise<SellerReview> {
  const newReview: SellerReview = {
    ...review,
    id: useFirebase ? "" : "local-rev-" + Math.random().toString(36).substr(2, 9),
    createdAt: Date.now()
  };

  if (useFirebase && db) {
    try {
      const reviewsRef = collection(db, "seller_reviews");
      const docRef = await addDoc(reviewsRef, newReview);
      newReview.id = docRef.id;
      return newReview;
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.WRITE, "seller_reviews");
      } else {
        console.warn("Firestore review save error, saving to LocalStorage fallback:", err);
      }
    }
  }

  // Fallback to LocalStorage
  const localData = localStorage.getItem(LOCAL_STORAGE_REVIEWS_KEY);
  const reviewsList: SellerReview[] = localData ? JSON.parse(localData) : [];
  if (!newReview.id) {
    newReview.id = "local-rev-" + Math.random().toString(36).substr(2, 9);
  }
  reviewsList.unshift(newReview);
  localStorage.setItem(LOCAL_STORAGE_REVIEWS_KEY, JSON.stringify(reviewsList));
  
  // Dispatch custom events to refresh real-time reviews
  window.dispatchEvent(new Event("autoparts_reviews_updated"));
  window.dispatchEvent(new Event("storage"));
  
  return newReview;
}

// ----------------------------------------------------
// NOTIFICATION SERVICES
// ----------------------------------------------------

export function subscribeToUserNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  onError?: (err: Error) => void
): () => void {
  console.log(`[Firestore Listener] subscribeToUserNotifications requested for userId: "${userId}"`);

  if (useFirebase && auth && db) {
    let unsubNotifications: (() => void) | null = null;
    let isUnsubscribed = false;

    const startListener = (authenticatedUid: string) => {
      if (isUnsubscribed) return;
      try {
        const notificationsRef = collection(db, "notifications");
        const q = query(
          notificationsRef, 
          where("recipientId", "==", authenticatedUid),
          where("read", "==", false)
        );

        console.log(`[Firestore Listener] Subscribing to unread notifications for recipientId == "${authenticatedUid}"`);
        unsubNotifications = onSnapshot(q, (snapshot) => {
          console.log(`[Firestore Listener Callback] Received notifications update. Size: ${snapshot.size}`);
          const list: Notification[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as Notification);
          });
          callback(list);
        }, (err) => {
          console.error(`[Firestore Listener Error] subscribeToUserNotifications failed:`, err);
          if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
            handleFirestoreError(err, OperationType.LIST, `notifications (recipientId == ${authenticatedUid})`);
          }
          if (onError) onError(err);
        });
      } catch (err: any) {
        console.error(`[Firestore Exception] subscribeToUserNotifications exception:`, err);
        if (onError) onError(err);
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (isUnsubscribed) return;
      if (firebaseUser) {
        if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }
        startListener(firebaseUser.uid);
      } else {
        if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }
        callback([]);
      }
    });

    return () => {
      isUnsubscribed = true;
      unsubAuth();
      if (unsubNotifications) unsubNotifications();
    };
  }

  // LocalStorage Fallback
  console.log(`[LocalStorage Fallback] subscribeToUserNotifications for userId: "${userId}"`);
  const loadLocal = () => {
    try {
      const raw = localStorage.getItem("autoparts_notifications");
      if (raw) {
        const list: Notification[] = JSON.parse(raw);
        const filtered = list.filter(n => n.recipientId === userId && !n.read);
        callback(filtered);
      } else {
        callback([]);
      }
    } catch (e: any) {
      if (onError) onError(e);
      else callback([]);
    }
  };

  loadLocal();
  const handleUpdate = () => {
    loadLocal();
  };

  window.addEventListener("autoparts_notifications_updated", handleUpdate);
  window.addEventListener("storage", handleUpdate);

  return () => {
    window.removeEventListener("autoparts_notifications_updated", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export async function markChatNotificationsAsRead(chatId: string, userId: string): Promise<void> {
  if (useFirebase && db) {
    const notificationId = `${chatId}_${userId}`;
    const path = `notifications/${notificationId}`;
    try {
      const notificationDocRef = doc(db, "notifications", notificationId);
      const docSnap = await getDoc(notificationDocRef);
      if (docSnap.exists()) {
        await updateDoc(notificationDocRef, { read: true });
        console.log(`[Firestore Notification] Marked notification ${notificationId} as read.`);
      }
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      } else {
        console.warn("Failed to mark notifications as read in Firestore:", err);
      }
    }
  }

  // LocalStorage Fallback
  const localNotificationsRaw = localStorage.getItem("autoparts_notifications");
  if (localNotificationsRaw) {
    try {
      const localNotifications: Notification[] = JSON.parse(localNotificationsRaw);
      const notificationId = `${chatId}_${userId}`;
      const updated = localNotifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
      localStorage.setItem("autoparts_notifications", JSON.stringify(updated));
      window.dispatchEvent(new Event("autoparts_notifications_updated"));
    } catch (e) {
      console.warn("Failed to update local notifications as read:", e);
    }
  }
}

export function subscribeToUserFavorites(
  userId: string,
  callback: (favorites: string[]) => void,
  onError?: (err: Error) => void
): () => void {
  console.log(`[Firestore Listener] subscribeToUserFavorites requested for userId: "${userId}"`);

  if (useFirebase && auth && db) {
    let unsubFavorites: (() => void) | null = null;
    let isUnsubscribed = false;

    const startListener = (authenticatedUid: string) => {
      if (isUnsubscribed) return;
      try {
        const favoritesRef = collection(db, "favorites");
        const q = query(favoritesRef, where("userId", "==", authenticatedUid));

        console.log(`[Firestore Listener] Subscribing to favorites for userId == "${authenticatedUid}"`);
        unsubFavorites = onSnapshot(q, (snapshot) => {
          console.log(`[Firestore Listener Callback] Received favorites update. Size: ${snapshot.size}`);
          const list: string[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data.partId) {
              list.push(data.partId);
            }
          });
          callback(list);
        }, (err) => {
          console.error(`[Firestore Listener Error] subscribeToUserFavorites failed:`, err);
          if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
            handleFirestoreError(err, OperationType.LIST, `favorites (userId == ${authenticatedUid})`);
          }
          if (onError) onError(err);
        });
      } catch (err: any) {
        console.error(`[Firestore Exception] subscribeToUserFavorites exception:`, err);
        if (onError) onError(err);
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (isUnsubscribed) return;
      if (firebaseUser) {
        if (unsubFavorites) { unsubFavorites(); unsubFavorites = null; }
        startListener(firebaseUser.uid);
      } else {
        if (unsubFavorites) { unsubFavorites(); unsubFavorites = null; }
        callback([]);
      }
    });

    return () => {
      isUnsubscribed = true;
      unsubAuth();
      if (unsubFavorites) unsubFavorites();
    };
  }

  // LocalStorage Fallback
  console.log(`[LocalStorage Fallback] subscribeToUserFavorites for userId: "${userId}"`);
  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(`autoparts_favorites_${userId}`);
      if (raw) {
        const list: string[] = JSON.parse(raw);
        callback(list);
      } else {
        const sharedRaw = localStorage.getItem("autoparts_favorites");
        if (sharedRaw) {
          const list: string[] = JSON.parse(sharedRaw);
          callback(list);
        } else {
          callback([]);
        }
      }
    } catch (e: any) {
      if (onError) onError(e);
      else callback([]);
    }
  };

  loadLocal();
  const handleUpdate = () => {
    loadLocal();
  };

  window.addEventListener("autoparts_favorites_updated", handleUpdate);
  window.addEventListener("storage", handleUpdate);

  return () => {
    window.removeEventListener("autoparts_favorites_updated", handleUpdate);
    window.removeEventListener("storage", handleUpdate);
  };
}

export async function addFavorite(userId: string, partId: string): Promise<void> {
  const favoriteId = `${userId}_${partId}`;
  const path = `favorites/${favoriteId}`;
  console.log(`[Firestore Write] addFavorite requested for favoriteId: "${favoriteId}"`);

  if (useFirebase && db) {
    try {
      const docRef = doc(db, "favorites", favoriteId);
      await setDoc(docRef, {
        id: favoriteId,
        userId,
        partId,
        createdAt: Date.now()
      }, { merge: true });
      console.log(`[Firestore Favorite] Saved favorite ${favoriteId}`);
      return;
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.WRITE, path);
      } else {
        console.warn("Failed to add favorite in Firestore:", err);
      }
      throw err;
    }
  }

  // LocalStorage Fallback
  try {
    const localKey = `autoparts_favorites_${userId}`;
    const raw = localStorage.getItem(localKey) || localStorage.getItem("autoparts_favorites");
    let list: string[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (e) {}
    }
    if (!list.includes(partId)) {
      list.push(partId);
    }
    localStorage.setItem(localKey, JSON.stringify(list));
    localStorage.setItem("autoparts_favorites", JSON.stringify(list));
    window.dispatchEvent(new Event("autoparts_favorites_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err: any) {
    console.error("[LocalStorage Error] Failed to add favorite:", err);
  }
}

export async function removeFavorite(userId: string, partId: string): Promise<void> {
  const favoriteId = `${userId}_${partId}`;
  const path = `favorites/${favoriteId}`;
  console.log(`[Firestore Delete] removeFavorite requested for favoriteId: "${favoriteId}"`);

  if (useFirebase && db) {
    try {
      const docRef = doc(db, "favorites", favoriteId);
      await deleteDoc(docRef);
      console.log(`[Firestore Favorite] Removed favorite ${favoriteId}`);
      return;
    } catch (err: any) {
      if (err?.code === "permission-denied" || err?.message?.includes("permission") || err?.message?.includes("Missing or insufficient permissions")) {
        handleFirestoreError(err, OperationType.DELETE, path);
      } else {
        console.warn("Failed to remove favorite in Firestore:", err);
      }
      throw err;
    }
  }

  // LocalStorage Fallback
  try {
    const localKey = `autoparts_favorites_${userId}`;
    const raw = localStorage.getItem(localKey) || localStorage.getItem("autoparts_favorites");
    let list: string[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch (e) {}
    }
    list = list.filter(id => id !== partId);
    localStorage.setItem(localKey, JSON.stringify(list));
    localStorage.setItem("autoparts_favorites", JSON.stringify(list));
    window.dispatchEvent(new Event("autoparts_favorites_updated"));
    window.dispatchEvent(new Event("storage"));
  } catch (err: any) {
    console.error("[LocalStorage Error] Failed to remove favorite:", err);
  }
}


