/* HEARTLYF — Firebase Authentication */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyCzVspRaeqMm6uab3DzvGNLJUkQrgJ60IE",
  authDomain: "heartmonitorproject-ba398.firebaseapp.com",
  databaseURL: "https://heartmonitorproject-ba398-default-rtdb.firebaseio.com",
  projectId: "heartmonitorproject-ba398",
  storageBucket: "heartmonitorproject-ba398.firebasestorage.app",
  messagingSenderId: "509942804692",
  appId: "1:509942804692:web:c2248b8a87205ff1974b41"
};


/* INITIALIZE FIREBASE (ONLY ONCE) */
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();


/* SAVE USER PROFILE */
async function saveUserProfile(user, role = "Patient") {

  const ref = doc(db, "users", user.uid);

  await setDoc(ref,{
    uid:user.uid,
    email:user.email,
    displayName:user.displayName,
    role:role,
    createdAt:serverTimestamp(),
    lastSeen:serverTimestamp()
  },{merge:true});
}


/* AUTH STATE */
export function onAuthChange(callback){
  onAuthStateChanged(auth,callback);
}


/* SIGN UP */
export async function signUpWithEmail({email,password,displayName,role}){

  try{

    const cred = await createUserWithEmailAndPassword(auth,email,password);

    await updateProfile(cred.user,{
      displayName:displayName
    });

    await sendEmailVerification(cred.user);

    await saveUserProfile(cred.user,role);

    return {user:cred.user};

  }catch(err){

    return {error:err.message};

  }
}


/* LOGIN */
export async function loginWithEmail(email,password){

  try{

    const cred = await signInWithEmailAndPassword(auth,email,password);

    if(!cred.user.emailVerified){

      await signOut(auth);

      return {error:"Verify your email first."};

    }

    return {user:cred.user};

  }catch(err){

    return {error:err.message};

  }
}


/* GOOGLE LOGIN */
export async function loginWithGoogle(){

  try{

    const cred = await signInWithPopup(auth,googleProvider);

    await saveUserProfile(cred.user);

    return {user:cred.user};

  }catch(err){

    return {error:err.message};

  }
}


/* LOGOUT */
export async function logout(){
  await signOut(auth);
}