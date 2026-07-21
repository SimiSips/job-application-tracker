import { initializeApp } from 'firebase/app';
import { getAuth} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment} from './environment/environment';

export const firebaseApp = initializeApp(environment);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp)
