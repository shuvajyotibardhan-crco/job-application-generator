import * as admin from 'firebase-admin';

admin.initializeApp();

export { resolveCompany }    from './resolveCompany';
export { generateApplication } from './generateApplication';
export { deleteApplication } from './deleteApplication';
export { downloadFile }      from './downloadFile';
export { extractImageText }  from './extractImageText';
