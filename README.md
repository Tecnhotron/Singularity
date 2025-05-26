# Singularity - Backend Implementation Guide

This document provides instructions for setting up and running the Singularity chat application backend.

## Overview

The backend is implemented using Flask and Firebase as requested. The key features include:

1. Chat creation and management
2. Message handling with Gemini API integration
3. User settings and API key management
4. Prompt Gems system
5. Fixed chat creation behavior (new chat is created when typing in input box on a new page)

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- Firebase account with Firestore database
- Gemini API key

### Installation

1. Install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
```

2. Configure Firebase:
   - Create a Firebase project in the Firebase console
   - Set up Firestore database
   - Generate a service account key and replace the placeholder in `firebase-key.json`

3. Configure Gemini API:
   - Get an API key from Google AI Studio
   - Update the API_KEY variable in `app.py` or use the settings UI

### Running the Application

Start the Flask server:

```bash
cd backend
python app.py
```

The application will be available at http://localhost:5000

## Implementation Details

### Backend Structure

- `app.py`: Main Flask application with all API endpoints
- `requirements.txt`: Python dependencies
- `firebase-key.json`: Firebase service account key (placeholder)

### API Endpoints

- `/api/chats`: GET (list chats), POST (create chat)
- `/api/chats/<chat_id>`: GET (get chat details)
- `/api/chats/<chat_id>/messages`: POST (add message)
- `/api/settings`: GET (get settings), POST (update settings)
- `/api/gems`: GET (get prompt gems)
- `/api/new-chat`: POST (create new chat with initial message)

### Frontend Integration

The frontend JavaScript has been modified to:
1. Create a new chat when typing in the input box on a new page
2. Maintain persistent chat history
3. Support the Prompt Gems system
4. Handle API key configuration

## Customization

- Update the Firebase configuration in `firebase-key.json`
- Modify the default Prompt Gems in the `get_gems` endpoint
- Adjust the Gemini API parameters in the `generate_ai_response` function

## Notes

- The login page is excluded from the backend implementation as requested
- The UI remains unchanged as specified
- The chat creation behavior is fixed to create a new chat when typing in the input box on a new page
