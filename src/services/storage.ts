import { ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, auth, functions } from '../firebase';

export const uploadBaseResume = async (file: File): Promise<string> => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `users/${uid}/resume/base.${ext}`);
  await uploadBytes(storageRef, file);
  return storageRef.fullPath;
};

export const getDownloadUrl = (path: string) =>
  getDownloadURL(ref(storage, path));

export const getFileBlob = (path: string) =>
  getBlob(ref(storage, path));

export async function getFileBlobViaFunction(storagePath: string, mime: string): Promise<Blob> {
  const fn = httpsCallable<{ storagePath: string }, { data: string }>(functions, 'downloadFile');
  const result = await fn({ storagePath });
  const bytes = Uint8Array.from(atob(result.data.data), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export const deleteFile = (path: string) =>
  deleteObject(ref(storage, path));
