import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendEmailVerification,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyCzVspRaeqMm6uab3DzvGNLJUkQrgJ60IE",
  authDomain: "heartmonitorproject-ba398.firebaseapp.com",
  databaseURL: "https://heartmonitorproject-ba398-default-rtdb.firebaseio.com",
  projectId: "heartmonitorproject-ba398",
  storageBucket: "heartmonitorproject-ba398.firebasestorage.app",
  messagingSenderId: "509942804692",
  appId: "1:509942804692:web:c2248b8a87205ff1974b41",
  measurementId: "G-HPP83R4R5G"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


/* SIGN UP */

export async function signUpWithEmail({email,password,displayName,role}){

  try{

    const cred = await createUserWithEmailAndPassword(auth,email,password);

    await updateProfile(cred.user,{
      displayName:displayName
    });

    await sendEmailVerification(cred.user);

    return {user:cred.user};

  }catch(error){

    return {error:error.message};

  }

}



/* LOGIN */

export async function loginWithEmail(email,password){

  try{

    const cred = await signInWithEmailAndPassword(auth,email,password);

    return {user:cred.user};

  }catch(error){

    return {error:error.message};

  }

}



/* GOOGLE LOGIN */

export async function loginWithGoogle(){

  try{

    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth,provider);

    return {user:result.user};

  }catch(error){

    return {error:error.message};

  }

}



/* LOGOUT */

export async function logout(){

  await signOut(auth);

}



/* AUTH LISTENER */

export function onAuthChange(callback){

  return onAuthStateChanged(auth,callback);

}