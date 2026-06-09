import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface ProfileUrl {
  id: string;
  label: string;
  url: string;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  baseResumeRef: string | null;
  baseResumeType: 'pdf' | 'docx' | 'gdocs' | 'png' | 'jpg' | null;
  profileUrls: ProfileUrl[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

const profileRef = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return doc(db, 'users', uid, 'private', 'profile');
};

export const getProfile = async (): Promise<UserProfile | null> => {
  const snap = await getDoc(profileRef());
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const saveProfile = async (profile: Partial<UserProfile>) => {
  await setDoc(profileRef(), { ...profile, updatedAt: serverTimestamp() }, { merge: true });
};

export const isProfileComplete = (profile: UserProfile | null): boolean => {
  if (!profile) return false;
  return !!(profile.fullName && profile.email && profile.phone && profile.city && profile.state && profile.baseResumeRef);
};
