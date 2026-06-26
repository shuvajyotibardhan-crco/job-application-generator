import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ApplicationStatus } from './applications';

export interface DashboardFilters {
  company: string;
  role: string;
  dateFrom: string;
  dateTo: string;
  statuses: ApplicationStatus[];
}

export const DEFAULT_FILTERS: DashboardFilters = {
  company: '',
  role: '',
  dateFrom: '',
  dateTo: '',
  statuses: [],
};

const prefsRef = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return doc(db, 'users', uid, 'preferences', 'dashboard');
};

export const getDashboardFilters = async (): Promise<DashboardFilters> => {
  try {
    const snap = await getDoc(prefsRef());
    if (!snap.exists()) return DEFAULT_FILTERS;
    const data = snap.data() as Partial<DashboardFilters>;
    return {
      company: data.company ?? '',
      role: data.role ?? '',
      dateFrom: data.dateFrom ?? '',
      dateTo: data.dateTo ?? '',
      statuses: data.statuses ?? [],
    };
  } catch {
    return DEFAULT_FILTERS;
  }
};

export const saveDashboardFilters = async (filters: DashboardFilters): Promise<void> => {
  try {
    await setDoc(prefsRef(), filters, { merge: true });
  } catch {
    // Non-critical — filters just won't persist this session
  }
};
