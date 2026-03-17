import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

function hasCfg(){
  const c = window.NOBLE_SOUL_FIREBASE_CONFIG || {};
  return c.apiKey && c.projectId && c.appId;
}

if(hasCfg()){
  const app = initializeApp(window.NOBLE_SOUL_FIREBASE_CONFIG);
  const auth = getAuth(app);
  onAuthStateChanged(auth, ()=>{});
}
