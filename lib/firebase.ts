import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAl8tqSYPvLEx3wVCMmR_X2vZUqEPSjm0A",
  authDomain: "smartexam-52684.firebaseapp.com",
  databaseURL: "https://smartexam-52684-default-rtdb.firebaseio.com",
  projectId: "smartexam-52684",
  storageBucket: "smartexam-52684.firebasestorage.app",
  messagingSenderId: "577752336500",
  appId: "1:577752336500:web:7540a1769041fb33dae921",
  measurementId: "G-PGHRSNV20H"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const app = firebase.app();
// Get a reference to the database service
export const db = firebase.database();
export const storage = firebase.storage();
export const auth = firebase.auth();
export { firebase };
