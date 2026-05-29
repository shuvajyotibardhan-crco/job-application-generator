import { ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from 'firebase/storage';
import { storage, auth } from '../firebase';

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

export const deleteFile = (path: string) =>
  deleteObject(ref(storage, path));
