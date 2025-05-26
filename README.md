# Singularity - Client-Side AI Assistant

## Overview

Singularity is a web-based AI chat application that leverages the power of Google Gemini models to provide an intelligent and interactive user experience. All core logic runs directly in the user's browser, with Firebase providing backend services for authentication and data storage.

## Features

*   **Chat Interface:** Intuitive and responsive interface for interacting with the AI.
*   **User Authentication:** Secure user login and registration using Firebase Authentication.
*   **Chat History:** Stores and retrieves chat conversations using Firebase Firestore.
*   **Prompt Gems:** Users can create and customize their own 'Prompt Gems' (personas with system prompts), which are stored in Firebase Firestore. Pre-defined templates are also available to kickstart conversations and explore AI capabilities.
*   **User Settings:** Allows users to customize their experience, including managing their API key.
*   **Image Generation:** Generate images based on text prompts.
*   **Document Generation:** Create documents based on AI responses.
*   **Tool Integration (Web Search, Browsing, Image/Document Generation):** Partially implemented. Users can toggle these tools, which modifies parameters sent to the Gemini API.
*   **File Uploads:** Allow users to upload files for AI processing.

## Tech Stack

*   **Frontend:** HTML, CSS, JavaScript
*   **Artificial Intelligence:** Google Gemini API
*   **Backend:** Firebase Authentication, Firebase Firestore
*   **Server:** Python Flask (for serving static files)

## Setup and Running Instructions

### Prerequisites

*   A modern web browser (Chrome, Firefox, Safari, Edge).
*   A Google Account.
*   A Google Gemini API Key.

### Firebase Setup

1.  Create a new project on the [Firebase Console](https://console.firebase.google.com/).
2.  Enable Firebase Authentication:
    *   Go to Authentication -> Sign-in method.
    *   Enable the "Email/Password" provider.
3.  Enable Firebase Firestore:
    *   Go to Firestore Database -> Create database.
    *   Start in "test mode" for initial development (ensure you understand the security implications before production).
4.  Obtain Firebase Configuration:
    *   Go to Project settings (gear icon next to Project Overview).
    *   Under "Your apps", click on the web icon (`</>`) to register a new web app.
    *   Copy the `firebaseConfig` object.
5.  Configure the application:
    *   Update the existing `js/firebase-config.js` file.
    *   Paste the copied `firebaseConfig` object into this file, ensuring it matches the structure below, and replace the placeholder values with your actual Firebase project configuration:
        ```javascript
        const firebaseConfig = {
          apiKey: "YOUR_API_KEY",
          authDomain: "YOUR_AUTH_DOMAIN",
          projectId: "YOUR_PROJECT_ID",
          storageBucket: "YOUR_STORAGE_BUCKET",
          messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
          appId: "YOUR_APP_ID"
        };
        ```
    *   **Important:** Replace the placeholder values with your actual Firebase project configuration.

### Running the Application

1.  **Set up your Gemini API Key:**
    *   After logging into the application, navigate to the "Settings" page.
    *   Enter your Google Gemini API Key in the designated field and save.
2.  **Start the Server:**
    *   Ensure you have Python installed.
    *   Open your terminal or command prompt.
    *   Navigate to the project's root directory.
    *   Run the command: `python server.py`
    *   This will typically start a local server at `http://127.0.0.1:7860`.
3.  Open your web browser and navigate to the address provided by the server (e.g., `http://127.0.0.1:7860`).

## Project Structure

*   `index.html`: The main chat interface.
*   `login.html`: The user login and registration page.
*   `css/style.css`: Stylesheets for the application.
*   `js/script.js`: Core JavaScript logic for the chat interface, Gemini API interaction, and Firebase integration.
*   `js/firebase-config.js`: Firebase project configuration (you need to update this).
*   `js/login.js`: JavaScript for user login logic.
*   `js/register.js`: JavaScript for user registration logic.
*   `js/image-generator.js`: JavaScript for image generation functionality.
*   `js/document-generator.js`: JavaScript for document generation functionality.
*   `server.py`: Simple Python Flask server to serve static files.
*   `LICENSE`: Project license file.
*   `README.md`: This file.

## How it Works

Singularity is designed with a client-centric architecture.
*   **Client-Side Logic:** The majority of the application's logic, including user interface management, API calls to Google Gemini, and interaction with Firebase services, runs directly in the user's web browser (primarily in `js/script.js`, `js/login.js`, `js/register.js`, etc.).
*   **Firebase for Backend:**
    *   Firebase Authentication is used for user sign-up and login.
    *   Firebase Firestore is used to store and retrieve user chat history and custom Prompt Gems.
*   **Gemini API Calls:** AI-powered responses are obtained by making direct calls to the Google Gemini API from the client-side JavaScript. The user's API key is managed through the settings and, for authenticated users, is stored in Firebase Firestore and cached in `localStorage` for convenience.
*   **Python Flask Server:** The `server.py` script provides a lightweight HTTP server to serve the HTML, CSS, and JavaScript files to the browser. It does not handle any core application logic or API requests.

## Customization/Development

*   **Firebase Configuration:** The primary point of configuration is `js/firebase-config.js`. You *must* update this file with your Firebase project's specific configuration details.
*   **Prompt Gems:** Default prompt gem templates are defined within `js/script.js`. Users can also create their own, which are stored in Firestore.
*   To add new features or modify existing behavior, you will primarily work with the HTML files for structure, `css/style.css` for presentation, and the JavaScript files (e.g., `js/script.js`, `js/login.js`, `js/register.js`, `js/image-generator.js`, `js/document-generator.js`) for application logic.

## License

This project is licensed under the terms of the LICENSE file.
