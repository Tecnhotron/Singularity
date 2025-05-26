// Firebase Authentication - Login
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

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
    
    // Email/Password Login
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async function() {
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const warning = document.getElementById('loginWarning');
            
            if (!email || !password) {
                showWarning(warning, 'Please enter both email and password.');
                return;
            }
            
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // User is signed in, redirection handled by auth state listener in firebase-config.js
                console.log('User logged in:', userCredential.user);
            } catch (error) {
                handleAuthError(error, warning);
            }
        });
    }
    
    // Forgot Password
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async function(event) {
            event.preventDefault(); // Prevent default link behavior
            const emailInput = document.getElementById('email');
            const email = emailInput.value.trim();
            const warning = document.getElementById('loginWarning'); // Use the same warning element for simplicity
            
            if (!email) {
                showWarning(warning, 'Please enter your email address to reset password.');
                emailInput.focus();
                return;
            }
            
            try {
                await sendPasswordResetEmail(auth, email);
                showWarning(warning, `Password reset email sent to ${email}. Please check your inbox.`);
                // Clear the message after a few seconds
                setTimeout(() => clearWarning(warning), 8000); 
            } catch (error) {
                console.error('Error sending password reset email:', error);
                // Provide more specific error messages based on error.code if desired
                if (error.code === 'auth/user-not-found') {
                    showWarning(warning, 'No user found with this email address.');
                } else if (error.code === 'auth/invalid-email') {
                    showWarning(warning, 'Invalid email address format.');
                } else {
                    showWarning(warning, 'Error sending password reset email. Please try again.');
                }
            }
        });
    }
    
    // Google Sign In
    const googleBtn = document.querySelector('.google-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            const warning = document.getElementById('loginWarning');
            
            try {
                const result = await signInWithPopup(auth, provider);
                // This gives you a Google Access Token
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                const user = result.user;
                console.log('Google sign-in successful', user);
                // Redirection handled by auth state listener
            } catch (error) {
                handleAuthError(error, warning);
            }
        });
    }
    
    // Link to register page
    const showSignupBtn = document.getElementById('showSignupBtn');
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }
    
    // Helper functions
    function showWarning(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }
    
    function clearWarning(element) {
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }
    
    function handleAuthError(error, warning) {
        console.error('Authentication error:', error);
        let errorMessage = 'An error occurred during authentication.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No user found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
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
