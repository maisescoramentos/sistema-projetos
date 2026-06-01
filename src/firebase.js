import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGrIjz76OlVyX0KAMAqw0k9j2-PDzk4GE",
  authDomain: "sistema-projetos-d6fab.firebaseapp.com",
  projectId: "sistema-projetos-d6fab",
  storageBucket: "sistema-projetos-d6fab.firebasestorage.app",
  messagingSenderId: "260714785178",
  appId: "1:260714785178:web:cf81889f9a9877d2cc7223"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);