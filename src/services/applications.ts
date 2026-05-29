import {
  collection, doc, getDocs, getDoc,
  updateDoc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../firebase';

export type ApplicationStatus = 'Submitted' | 'In Progress' | 'Completed';

export interface Application {
  appId: string;
  uid: string;
  companyName: string;
  companySlug: string;
  roleTitle: string;
  jobDescription: string;
  status: ApplicationStatus;
  generatedAt: unknown;
  resumeStoragePath: string;
  coverLetterStoragePath: string;
  createdAt: unknown;
  updatedAt: unknown;
  aiDetectionWarning?: boolean;
}

const STATUS_ORDER: ApplicationStatus[] = ['Submitted', 'In Progress', 'Completed'];

export const nextStatus = (current: ApplicationStatus): ApplicationStatus | null => {
  const idx = STATUS_ORDER.indexOf(current);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
};

const appsCol = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return collection(db, 'users', uid, 'applications');
};

export const listApplications = async (): Promise<Application[]> => {
  const q = query(appsCol(), orderBy('generatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ appId: d.id, ...d.data() } as Application));
};

export const getApplication = async (appId: string): Promise<Application | null> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const snap = await getDoc(doc(db, 'users', uid, 'applications', appId));
  return snap.exists() ? ({ appId: snap.id, ...snap.data() } as Application) : null;
};

export const updateStatus = async (appId: string, status: ApplicationStatus) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  await updateDoc(doc(db, 'users', uid, 'applications', appId), { status, updatedAt: serverTimestamp() });
};

export const resolveCompany = (companyName: string) =>
  httpsCallable(functions, 'resolveCompany')({ companyName });

export const generateApplication = (payload: {
  companySlug: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
}) => httpsCallable(functions, 'generateApplication')(payload);

export const deleteApplicationCall = (appId: string) =>
  httpsCallable(functions, 'deleteApplication')({ appId });
