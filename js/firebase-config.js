// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js";
// Note: Firebase AI is imported directly in image-generator.js to avoid loading it unnecessarily

const firebaseConfig = {

};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Function to get the Firebase app instance
export function getFirebaseApp() {
  return app;
}

// Export the auth, db, and storage instances
export { app, auth, db, storage };

// Handle auth state changes
// This can be useful for global redirection or logging
onAuthStateChanged(auth, user => {
  if (user) {
    // User is signed in
    console.log('User is signed in (from firebase-config.js):', user);
    // Dispatch event with user details
    const event = new CustomEvent('userAuthenticated', {
      detail: {
        name: user.displayName || user.email.split('@')[0], // Fallback for name
        email: user.email
      }
    });
    window.dispatchEvent(event);

    // Redirect to home page if user is already logged in and tries to access login/register pages
    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
      window.location.href = 'index.html';
    }
  } else {
    // User is signed out
    console.log('User is signed out (from firebase-config.js)');
    // Dispatch sign out event
    window.dispatchEvent(new CustomEvent('userSignedOut'));

    // If user is signed out, redirect to login page if they are not already on login/register
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
      window.location.href = 'login.html';
    }
  }
});
