// Firebase Authentication - Registration
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Google Provider
    const provider = new GoogleAuthProvider();
    
    // Password toggle functionality
    const togglePasswordBtn = document.querySelector('.toggle-password');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('.material-symbols-rounded');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.textContent = 'visibility_off';
            } else {
                passwordInput.type = 'password';
                icon.textContent = 'visibility';
            }
        });
    }
    
    // Email/Password Registration
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', async function() {
            const name = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const warning = document.getElementById('registerWarning');
            
            if (!name || !email || !password) {
                showWarning(warning, 'Please fill in all fields.');
                return;
            }
            
            if (password.length < 6) {
                showWarning(warning, 'Password should be at least 6 characters.');
                return;
            }
            
            try {
                // Create user with email and password
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Update user profile with display name
                await updateProfile(user, {
                    displayName: name
                });
                
                // Create a user document in Firestore
                await setDoc(doc(db, 'users', user.uid), {
                    name: name,
                    email: email,
                    createdAt: new Date(),
                    lastLogin: new Date()
                });
                
                console.log('User registered successfully:', user);
                // Redirection handled by auth state listener
                
            } catch (error) {
                handleAuthError(error, warning);
            }
        });
    }
    
    // Google Sign Up
    const googleBtn = document.querySelector('.google-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const warning = document.getElementById('registerWarning');
            
            try {
                const result = await signInWithPopup(auth, provider);
                // This gives you a Google Access Token
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                const user = result.user;
                
                // Check if user is new
                if (result._tokenResponse.isNewUser) {
                    // Create a user document in Firestore for new Google users
                    await setDoc(doc(db, 'users', user.uid), {
                        name: user.displayName || user.email.split('@')[0],
                        email: user.email,
                        photoURL: user.photoURL,
                        provider: 'google.com',
                        createdAt: new Date(),
                        lastLogin: new Date()
                    });
                }
                
                console.log('Google sign-up successful', user);
                // Redirection handled by auth state listener
                
            } catch (error) {
                handleAuthError(error, warning);
            }
        });
    }
    
    // Link to login page
    const showLoginBtn = document.getElementById('showLoginBtn');
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }
    
    // Helper functions
    function showWarning(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }
    
    function handleAuthError(error, warning) {
        console.error('Authentication error:', error);
        let errorMessage = 'An error occurred during registration.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters.';
                break;
            case 'auth/popup-closed-by-user':
                // Don't show error if user closed the popup
                return;
            default:
                errorMessage = error.message || errorMessage;
        }
        
        showWarning(warning, errorMessage);
    }
});
