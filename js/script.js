// Modified script.js to fix the chat creation behavior
// When typing a message in the input box on a new page, it creates a new chat instead of taking to old chat

import { auth, db, getFirebaseApp, storage } from './firebase-config.js'; // Ensure db and storage are imported
import { signOut } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';
import {
    collection, addDoc, deleteDoc, doc, getDoc, getDocs, limit, 
    orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { generateImage, isImageGenerationAvailable } from './image-generator.js';
import { imageGenerationTool, processToolCalls } from './image-tool.js';
import { documentGenerationTool } from './document-tool.js';
import { createImageLoadingPlaceholder, createImageResultHTML } from './image-utils.js';
import { createDocumentLoadingPlaceholder, createDocumentResultHTML } from './document-utils.js';

// Determine current page
const currentPage = window.location.pathname.split('/').pop() || 'index.html';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const signupScreen = document.getElementById('signupScreen');
const appContainer = document.getElementById('appContainer');
const showSignupBtn = document.getElementById('showSignupBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const userMenuToggle = document.getElementById('userMenuToggle');
const userMenu = document.getElementById('userMenu');
const settingsBtn = document.getElementById('settingsBtn');
const logoutBtn = document.getElementById('logoutBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const toggleApiKey = document.getElementById('toggleApiKey');
const apiKeyInput = document.getElementById('apiKey');
const modelSelector = document.getElementById('modelSelector');
const defaultModel = document.getElementById('defaultModel');
const timeGreeting = document.getElementById('timeGreeting');
const chatInput = document.querySelector('.chat-input textarea');
const sendBtn = document.querySelector('.send-btn');
const welcomeContainer = document.querySelector('.welcome-container');
const messagesContainer = document.querySelector('.chat-messages');
const chatHistoryList = document.getElementById('chatHistoryList');
const userMenuGemsList = document.getElementById('userMenuGemsList'); // For displaying gems in user menu
const openGemModalFromUserMenuBtn = document.getElementById('openGemModalFromUserMenuBtn'); // Button in user menu to open gem modal

const addNewGemBtn = document.getElementById('addNewGemBtn');
const gemModal = document.getElementById('gemModal');
const closeGemModalBtn = document.getElementById('closeGemModalBtn');
const cancelGemModalBtn = document.getElementById('cancelGemModalBtn');
const saveGemBtn = document.getElementById('saveGemBtn');
const gemNameInput = document.getElementById('gemName');
const systemPromptInput = document.getElementById('systemPrompt');
const gemOptions = document.querySelectorAll('#gemModal .gem-option');
const existingGemsList = document.getElementById('existingGemsList');
const noGemsMessage = document.getElementById('noGemsMessage');
const inputGemsContainer = document.querySelector('.chat-input .input-gems');

// User profile display elements
const headerAvatarDisplay = document.getElementById('headerAvatarDisplay'); // Updated ID
const userMenuProfilePicDisplay = document.getElementById('userMenuProfilePicDisplay'); // Updated ID
const userMenuName = document.querySelector('.user-menu .user-details h3');
const userMenuEmail = document.querySelector('.user-menu .user-details p');

// Configuration object for advanced Gemini features
const confignew = {
    // Will hold configuration for tools like web search
    generationConfig: {
        temperature: 1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192
    },
    // Tools configuration for the Gemini API
    tools: [
        {
            functionDeclarations: [imageGenerationTool, documentGenerationTool]
        }
    ]
}

// Configuration for document generation only (like image generation)
const documentOnlyConfig = {
    generationConfig: {
        temperature: 1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192
    },
    tools: [
        {
            functionDeclarations: [documentGenerationTool]
        }
    ]
}

// App State
const state = {
    isAuthenticated: false,
    userId: null,
    editingGemId: null, // To keep track of the gem being edited
    deletingChatId: null, // To keep track of the chat being deleted
    user: {
        name: '', // Initialize as empty
        email: '', // Initialize as empty
        apiKey: localStorage.getItem('geminiApiKey') || '',
        profilePicUrl: '', // Initialize as empty
    },
    settings: {
        model: localStorage.getItem('defaultModel') || 'gemini-2.5-pro-preview-05-06',
        theme: localStorage.getItem('theme') || 'dark',
    },
    chat: {
        currentChatId: localStorage.getItem('currentChatId') || null, // Load last active chat on index
        messages: [],
        currentGem: '', // Default gem
        isThinking: false,
        imageData: null, // To store the current image data for upload
        imageType: null, // To store the MIME type of the image
    },
    enabledTools: {  // Track which tools are enabled
        imageGeneration: false,
        webSearch: false,
        websiteBrowsing: false,
        documentGeneration: false
    },
    availableModels: [] // To store fetched models
};

const defaultGemTemplates = {
    ruby: {
        name: "Creative Ruby",
        prompt: "You are a creative assistant, skilled in brainstorming, writing, and artistic endeavors. Help the user explore new ideas and express themselves creatively."
    },
    sapphire: {
        name: "Analytical Sapphire",
        prompt: "You are an analytical assistant, specializing in logic, data analysis, and problem-solving. Provide clear, concise, and data-driven insights."
    },
    emerald: {
        name: "Knowledgeable Emerald",
        prompt: "You are a knowledgeable assistant, a walking encyclopedia. Answer questions accurately and provide detailed explanations on a wide range of topics."
    },
    amethyst: {
        name: "Empathetic Amethyst",
        prompt: "You are an empathetic assistant, focused on understanding user emotions and providing supportive and thoughtful responses. Engage in compassionate conversation."
    },
    topaz: {
        name: "Strategic Topaz",
        prompt: "You are a strategic assistant, adept at planning, decision-making, and outlining steps to achieve goals. Help the user create effective strategies."
    },
    diamond: {
        name: "Precise Diamond",
        prompt: "You are a precise assistant, excelling in tasks requiring accuracy, detail-orientation, and adherence to instructions, such as coding or technical writing."
    }
};

// Initialize App
async function initApp() { // Made async to await fetchGeminiModels
    // Set initial values from localStorage
    console.log('Initializing app on page:', currentPage);

    if (state.user.apiKey) {
        apiKeyInput.value = state.user.apiKey;
        await fetchGeminiModels(); // Await model fetching
    } else {
        useDefaultModels();
    }
    
    if (state.settings.model) {
        const currentModelExists = Array.from(modelSelector.options).some(option => option.value === state.settings.model);
        if (currentModelExists) {
            modelSelector.value = state.settings.model;
            defaultModel.value = state.settings.model;
        } else {
            if (modelSelector.options.length > 0) {
                state.settings.model = modelSelector.options[0].value;
                localStorage.setItem('defaultModel', state.settings.model);
                modelSelector.value = state.settings.model;
                defaultModel.value = state.settings.model;
            }
        }
    }
    
    updateTimeGreeting(); 
    setupEventListeners(); 

    // Check if user is authenticated for Firebase operations
    if (auth.currentUser) {
        console.log(`User is authenticated: ${auth.currentUser.uid}, will use Firebase for chat data`);
        state.isAuthenticated = true;
        state.userId = auth.currentUser.uid;

        // If current chat is a local one, reset it as we are now authenticated
        if (state.chat.currentChatId && typeof state.chat.currentChatId === 'string' && state.chat.currentChatId.startsWith('local-chat-')) {
            console.log(`Resetting state.chat.currentChatId from ${state.chat.currentChatId} (local) as user is authenticated.`);
            state.chat.currentChatId = null;
            // Optionally clear UI elements related to the old local chat
            const messagesDiv = document.getElementById('chat-messages');
            if (messagesDiv) messagesDiv.innerHTML = ''; // Clear messages
            const chatTitleDisplay = document.getElementById('chat-title-display');
            if (chatTitleDisplay) chatTitleDisplay.textContent = 'New Chat'; // Reset title
        }
        await loadUserProfile(state.userId); // Load user profile including pic
    } else {
        console.log('No user is currently authenticated, using localStorage for chat data');
        state.isAuthenticated = false;
        state.userId = null;
    }
    
    // Load chat history from Firebase or localStorage
    await loadChatHistory();
    if (state.chat.currentChatId) {
        await loadChatMessages(state.chat.currentChatId);
    } else {
        // If no current chat ID, ensure welcome screen is displayed
        clearChatMessagesUI(); 
    }
    loadUserGemsForInput(); // Load gems from local storage

    // Load user profile if already authenticated
    window.addEventListener('userAuthenticated', async (event) => {
        state.isAuthenticated = true;
        state.userId = auth.currentUser.uid; // Get UID directly from auth
        console.log('User authenticated event received. User ID:', state.userId);

        // Load all user profile data, which will update name, email, and avatar
        await loadUserProfile(state.userId);

        updateTimeGreeting(); // Update greeting (might use the name loaded by loadUserProfile)
        
        // Now that user is authenticated, load chat history from Firebase
        console.log('User authenticated, loading chats from Firebase');
        await loadChatHistory();
        
        // If current chat is a local one, reset it as we are now authenticated
        if (state.chat.currentChatId && typeof state.chat.currentChatId === 'string' && state.chat.currentChatId.startsWith('local-chat-')) {
            console.log(`Resetting state.chat.currentChatId from ${state.chat.currentChatId} (local) as user is authenticated.`);
            state.chat.currentChatId = null;
            localStorage.removeItem('currentChatId'); // Also remove from local storage
            // Optionally clear UI elements related to the old local chat
            const messagesDiv = document.getElementById('chat-messages');
            if (messagesDiv) messagesDiv.innerHTML = ''; // Clear messages
            const chatTitleDisplay = document.getElementById('chat-title-display');
            if (chatTitleDisplay) chatTitleDisplay.textContent = 'New Chat'; // Reset title
        }
        
        await loadUserGemsForInput(); // Refresh gems for the authenticated user
        await populateUserMenuGems(); // Refresh gems in user menu
    });  

    window.addEventListener('userSignedOut', () => {
        state.user.name = '';
        state.user.email = '';
        console.log('User signed out in script.js');
        updateTimeGreeting(); 
        clearChatHistoryUI(); 
        clearChatMessagesUI(); 
        state.chat.currentChatId = null;
        localStorage.removeItem('currentChatId');

        // Revert user-specific UI elements
        if (headerAvatarDisplay) {
            headerAvatarDisplay.src = 'images/avatar-placeholder.png';
            headerAvatarDisplay.onerror = function() { this.src='https://ui-avatars.com/api/?name=User&background=333&color=fff'; }; 
        }
        if (userMenuProfilePicDisplay) {
            userMenuProfilePicDisplay.src = 'images/avatar-placeholder.png';
            userMenuProfilePicDisplay.onerror = function() { this.src='https://ui-avatars.com/api/?name=User&background=333&color=fff'; }; 
        }
        if (userMenuName) {
            userMenuName.textContent = 'Guest User';
        }
        if (userMenuEmail) {
            userMenuEmail.textContent = '';
        }
        // Clear gems and reload chat history (which will show empty state)
        if(inputGemsContainer) inputGemsContainer.innerHTML = '';
        if(existingGemsList) existingGemsList.innerHTML = '<p id="noGemsMessage">No gems saved yet.</p>';
        loadChatHistory(); // To refresh and show 'No chats yet' if applicable
    });


}

// Update time-based greeting and fetch daily quote
function updateTimeGreeting() {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour >= 5 && hour < 12) {
        greeting = 'Good Morning';
    } else if (hour >= 12 && hour < 18) {
        greeting = 'Good Afternoon';
    } else if (hour >= 18 && hour < 22) {
        greeting = 'Good Evening';
    } else {
        greeting = 'Good Night';
    }
    
    if (timeGreeting) {
        // Display name only if it exists (user is logged in)
        timeGreeting.textContent = state.user.name ? `${greeting} ${state.user.name}` : greeting;
    }
    
    // Fetch and display a daily quote
    fetchDailyQuote();
}

// Fetch or generate a daily quote
async function fetchDailyQuote() {
    const quoteText = document.getElementById('quoteText');
    const quoteAuthor = document.getElementById('quoteAuthor');
    
    if (!quoteText || !quoteAuthor) return;
    
    // Local quotes collection to use when API is unavailable
    const localQuotes = [
        { q: "The best way to predict the future is to create it.", a: "Peter Drucker" },
        { q: "Innovation distinguishes between a leader and a follower.", a: "Steve Jobs" },
        { q: "The only way to do great work is to love what you do.", a: "Steve Jobs" },
        { q: "Creativity is intelligence having fun.", a: "Albert Einstein" },
        { q: "The future belongs to those who believe in the beauty of their dreams.", a: "Eleanor Roosevelt" },
        { q: "Simplicity is the ultimate sophistication.", a: "Leonardo da Vinci" },
        { q: "The greatest glory in living lies not in never falling, but in rising every time we fall.", a: "Nelson Mandela" },
        { q: "The way to get started is to quit talking and begin doing.", a: "Walt Disney" },
        { q: "Your time is limited, don't waste it living someone else's life.", a: "Steve Jobs" },
        { q: "Wisdom is the reward of experience and should be shared.", a: "Singularity" }
    ];
    
    try {
        // Check if we already have a quote stored for today
        const today = new Date().toDateString();
        const storedQuote = localStorage.getItem('dailyQuote');
        const storedDate = localStorage.getItem('dailyQuoteDate');
        
        // If we have a quote stored for today, use it
        if (storedQuote && storedDate === today) {
            const quoteData = JSON.parse(storedQuote);
            quoteText.textContent = quoteData.q;
            quoteAuthor.textContent = quoteData.a;
            return;
        }
        
        // Try to fetch from API first (without CORS proxy)
        try {
            const response = await fetch('https://zenquotes.io/api/random', { mode: 'no-cors' });
            // If we get here with no-cors, we can't actually read the response data due to CORS restrictions
            // This will throw an error and we'll fall back to local quotes
            const data = await response.json();
            
            if (data && data.length > 0) {
                const quote = data[0];
                quoteText.textContent = quote.q;
                quoteAuthor.textContent = quote.a;
                
                // Store the quote for today
                localStorage.setItem('dailyQuote', JSON.stringify(quote));
                localStorage.setItem('dailyQuoteDate', today);
                return;
            }
        } catch (apiError) {
            console.log('API fetch failed, using local quotes instead');
            // Continue to local quotes if API fails
        }
        
        // Use a random quote from our local collection
        const randomIndex = Math.floor(Math.random() * localQuotes.length);
        const randomQuote = localQuotes[randomIndex];
        
        quoteText.textContent = randomQuote.q;
        quoteAuthor.textContent = randomQuote.a;
        
        // Store the quote for today
        localStorage.setItem('dailyQuote', JSON.stringify(randomQuote));
        localStorage.setItem('dailyQuoteDate', today);
        
    } catch (error) {
        console.error('Error handling quote:', error);
        // Fallback to default quote
        quoteText.textContent = 'Wisdom is the reward of experience and should be shared.';
        quoteAuthor.textContent = 'Singularity';
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Login/Signup Navigation
    if (showSignupBtn) {
        showSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginScreen.style.display = 'none';
            signupScreen.style.display = 'flex';
        });


    }
    
    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signupScreen.style.display = 'none';
            loginScreen.style.display = 'flex';
        });


    }
    
    // Login Button
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            loginScreen.style.display = 'none';
            appContainer.style.display = 'flex';
        });


    }
    
    // Signup Button
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('signup-name');
            if (nameInput && nameInput.value) {
                state.user.name = nameInput.value;
                updateTimeGreeting();
            }
            signupScreen.style.display = 'none';
            appContainer.style.display = 'flex';
        });


    }
    
    // User Menu Toggle
    if (userMenuToggle) {
        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling up
            if (userMenu) {
                const isOpening = userMenu.style.display === 'none' || userMenu.style.display === '';
                userMenu.style.display = isOpening ? 'block' : 'none';
                if (isOpening && auth.currentUser) {
                    populateUserMenuGems(); // Populate gems when menu is opened
                }
            }
            console.log('Menu toggled, current display:', userMenu.style.display); // Debug
        });


        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuToggle.contains(e.target) && !userMenu.contains(e.target) && userMenu.style.display === 'block') {
                userMenu.style.display = 'none';
            }
        });


        
        // Ensure the menu is initially hidden
        userMenu.style.display = 'none';
    }
    // Settings Button
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
            userMenu.style.display = 'none';
        });


    }
    
    // Close Settings Modal
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });


    }
    
    // Cancel Settings Button
    if (cancelSettingsBtn) {
        cancelSettingsBtn.addEventListener('click', () => {
            // Reset form values to stored state
            apiKeyInput.value = state.user.apiKey;
            defaultModel.value = state.settings.model;
            settingsModal.style.display = 'none';
        });


    }
    
    // Add New Gem Button (this is the 'Open Gem Modal' button)
    if (addNewGemBtn) {
        addNewGemBtn.addEventListener('click', async () => {
            console.log('Add New Gem button clicked (opens gem modal).');
            if (gemModal) {
                gemModal.style.display = 'flex'; // Show the modal
                
                // Reset form fields and state for new gem creation
                if (gemNameInput) gemNameInput.value = '';
                if (systemPromptInput) systemPromptInput.value = '';
                state.editingGemId = null; // Crucial: reset editing state
                if (saveGemBtn) saveGemBtn.textContent = 'Save Gem'; // Reset button text
                
                // Reset gem type selection and pre-fill with default template
                if (gemOptions) {
                    gemOptions.forEach(opt => opt.classList.remove('selected'));
                    if (gemOptions.length > 0) {
                        const defaultOption = gemOptions[0];
                        defaultOption.classList.add('selected'); // Select the first/default type (e.g., Ruby)

                        // Pre-fill with the template for this default selected type
                        // This ensures fields are populated when modal opens for a new gem
                        if (state.editingGemId === null) { // Double-check we are in new gem mode
                            const gemTypeSpan = defaultOption.querySelector('span');
                            if (gemTypeSpan) {
                                const gemType = gemTypeSpan.textContent.trim().toLowerCase();
                                const template = await getUserSpecificOrDefaultTemplate(gemType); // Use the new async function
                                if (template) {
                                    if (gemNameInput) gemNameInput.value = template.name;
                                    if (systemPromptInput) systemPromptInput.value = template.prompt;
                                    console.log(`Modal opened: Pre-filled form with ${gemType} template.`);
                                }
                            }
                        }
                    }
                }

                loadUserGemsForModal(); // Load existing gems into the modal's list
                console.log('Gem modal opened, form reset, default type selected & pre-filled, and existing gems loaded.');
            } else {
                console.error('Gem modal element not found.');
            }
            if (userMenu) { // Hide the main user menu
                userMenu.style.display = 'none';
            }
        });


    }

    // Close Gem Modal Button
    if (closeGemModalBtn) {
        closeGemModalBtn.addEventListener('click', () => {
            if (gemModal) {
                gemModal.style.display = 'none';
            }
        });


    }

    // Cancel Gem Modal Button
    if (cancelGemModalBtn) {
        cancelGemModalBtn.addEventListener('click', () => {
            if (gemModal) {
                gemModal.style.display = 'none';
            }
            // Optionally, reset form fields within the gem modal here
        });


    }

    // Gem Option Selection in Modal
    gemOptions.forEach(option => {
        option.addEventListener('click', async () => {
            // Visually select the clicked option
            gemOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // If creating a new gem (not editing), pre-fill from template
            if (state.editingGemId === null) {
                const gemTypeSpan = option.querySelector('span'); // Assumes a span holds the gem type name e.g., <span>Ruby</span>
                if (gemTypeSpan) {
                    const gemType = gemTypeSpan.textContent.trim().toLowerCase();
                    const template = await getUserSpecificOrDefaultTemplate(gemType);
                    if (template) {
                        if (gemNameInput) gemNameInput.value = template.name;
                        if (systemPromptInput) systemPromptInput.value = template.prompt;
                        console.log(`Pre-filled form with ${gemType} template.`);
                    } else {
                        // Optionally clear fields if no template or a 'none' type is selected
                        // if (gemNameInput) gemNameInput.value = '';
                        // if (systemPromptInput) systemPromptInput.value = '';
                        console.log(`No template found for ${gemType}. Fields not pre-filled.`);
                    }
                }
            }
        });


    });



    // Save Gem Button
    if (saveGemBtn) {
        saveGemBtn.addEventListener('click', async () => {
            console.log('Save Gem button clicked.');
            const name = gemNameInput.value.trim();
            const prompt = systemPromptInput.value.trim();
            console.log(`Gem Name: "${name}", System Prompt: "${prompt.substring(0, 50)}..."`); // Log only part of prompt
            
            const selectedOption = document.querySelector('#gemModal .gem-option.selected');
            let type = null;

            if (selectedOption) {
                console.log('Selected gem option found:', selectedOption.outerHTML.split('>')[0] + '>'); // Log opening tag
                const gemClasses = ['ruby', 'sapphire', 'emerald', 'amethyst', 'topaz', 'diamond'];
                for (const cls of selectedOption.classList) {
                    if (gemClasses.includes(cls)) {
                        type = cls;
                        break;
                    }
                }
                console.log('Determined gem type:', type);
            } else {
                console.log('No gem option selected.');
            }

            if (!name) {
                showToast('Gem name cannot be empty.');
                console.log('Validation failed: Gem name empty.');
                return;
            }
            if (!prompt) {
                showToast('System prompt cannot be empty.');
                console.log('Validation failed: System prompt empty.');
                return;
            }
            if (!type) {
                showToast('Please select a gem type.');
                console.log('Validation failed: No gem type selected.');
                return;
            }
            if (!auth.currentUser) {
                showToast('You must be logged in to save gems.');
                console.log('Validation failed: User not logged in. Current user:', auth.currentUser);
                return;
            }
            console.log('All validations passed. Current user ID:', auth.currentUser.uid);

            const gemData = {
                name,
                prompt,
                type,
                userId: auth.currentUser.uid,
                createdAt: serverTimestamp()
            };
            console.log('Gem data prepared:', gemData);

            const gemDataForSave = {
                userId: auth.currentUser.uid,
                name: name,
                type: type,
                prompt: prompt,
            };

            try {
                if (state.editingGemId) {
                    // Update existing gem
                    console.log(`Updating existing gem with ID: ${state.editingGemId}`);
                    const gemRef = doc(db, 'gems', state.editingGemId);
                    await updateDoc(gemRef, {
                        ...gemDataForSave,
                        updatedAt: serverTimestamp()
                    });


                    showToast('Gem updated successfully!');
                    console.log('Gem updated in Firestore. ID:', state.editingGemId);
                } else {
                    // Check if a gem with the same type already exists
                    console.log('Checking for existing gems of type:', type);
                    const gemsRef = collection(db, 'gems');
                    const q = query(gemsRef, 
                                    where('userId', '==', auth.currentUser.uid), 
                                    where('type', '==', type));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        // Found an existing gem of the same type, automatically update it
                        const existingGem = querySnapshot.docs[0];
                        const existingGemData = existingGem.data();
                        console.log(`Found existing gem of type ${type}:`, existingGemData.name);
                        console.log(`Automatically updating existing gem with ID: ${existingGem.id}`);
                        
                        // Update the existing gem
                        const gemRef = doc(db, 'gems', existingGem.id);
                        await updateDoc(gemRef, {
                            ...gemDataForSave,
                            updatedAt: serverTimestamp()
                        });


                        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} gem updated!`);
                        console.log('Gem updated in Firestore. ID:', existingGem.id);
                    } else {
                        // No existing gem of this type, add new gem
                        console.log('No existing gem of this type. Adding new gem.');
                        const docRef = await addDoc(collection(db, 'gems'), {
                            ...gemDataForSave,
                            createdAt: serverTimestamp()
                        });


                        showToast('Gem saved successfully!');
                        console.log('New gem saved to Firestore with ID:', docRef.id);
                    }
                }
                
                // Common post-save/update actions
                if (gemModal) gemModal.style.display = 'none';
                gemNameInput.value = '';
                systemPromptInput.value = '';
                state.editingGemId = null; // Reset editing state
                if(saveGemBtn) saveGemBtn.textContent = 'Save Gem'; // Reset button text
                gemOptions.forEach(opt => opt.classList.remove('selected'));
                if (gemOptions.length > 0) {
                    gemOptions[0].classList.add('selected');
                }
                loadUserGemsForInput(); // Refresh gems in input area
                loadUserGemsForModal(); // Refresh gems in modal list
                console.log('Gem saved/updated, modal closed, form reset, UI refreshed.');
            } catch (error) {
                // Log the full error object for more details
                console.error('Error in saveGemBtn listener during Firestore operation or UI update:', error);
                showToast('Error saving gem. Please try again.'); // ERROR UI
            }
        });


    }
    
    // Save Settings Button
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => { // Made async
            const oldApiKey = state.user.apiKey; // Capture old API key
            
            try {
                // Get values from form
                const apiKey = apiKeyInput.value.trim();
                const selectedModel = defaultModel.value;
                
                // Update state
                state.user.apiKey = apiKey;
                state.settings.model = selectedModel;
                
                // Save settings (handles both localStorage and Firestore)
                await saveSettings();
                
                // Close modal
                settingsModal.style.display = 'none';
                
                // Refresh models if API key is provided
                if (apiKey) {
                    await fetchGeminiModels();
                } else {
                    useDefaultModels();
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                showToast('Error saving settings', 'error');
            } finally {
                hideLoadingScreen(); // Hide loading screen when done
            }
        });
    }
    
    // Toggle API Key Visibility
    if (toggleApiKey) {
        toggleApiKey.addEventListener('click', () => {
            const type = apiKeyInput.getAttribute('type');
            apiKeyInput.setAttribute('type', type === 'password' ? 'text' : 'password');
            toggleApiKey.querySelector('span').textContent = type === 'password' ? 'visibility_off' : 'visibility';
        });


    }
    
    // Model Selector
    if (modelSelector) {
        modelSelector.addEventListener('change', () => {
            state.settings.model = modelSelector.value;
            localStorage.setItem('defaultModel', state.settings.model);
        });


    }
    
    // Chat Input and Send Button
    if (chatInput && sendBtn) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        sendBtn.addEventListener('click', handleSendMessage);
    }
}
    // File upload handling (images and PDFs)
    const uploadFileBtn = document.getElementById('uploadFileBtn');
    const fileInput = document.getElementById('fileInput');
    let currentFile = null;

    if (uploadFileBtn && fileInput) {
        // Open file dialog when upload button is clicked
        uploadFileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // Handle file selection
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            currentFile = file;
            
            if (file.type.startsWith('image/')) {
                processImageFile(file);
            } else if (file.type === 'application/pdf') {
                processPdfFile(file);
            }
        });
    }

    // Handle paste events on the textarea for images
    if (chatInput) {
        chatInput.addEventListener('paste', (event) => {
            const items = (event.clipboardData || event.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') === 0) {
                    event.preventDefault();
                    const blob = item.getAsFile();
                    processImageFile(blob);
                    break;
                }
            }
        });
    }

    // Logout Button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => { // Make async for signOut
            try {
                await signOut(auth);
                console.log('User signed out successfully');
                // The onAuthStateChanged listener in firebase-config.js should handle redirection
                // to login.html if this page (index.html) requires authentication.
                // However, explicitly redirecting here ensures the user is taken to the login page.
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error signing out: ', error);
                // Optionally, display an error message to the user
            }
            // if (appContainer) appContainer.style.display = 'none';
            // if (loginScreen) loginScreen.style.display = 'flex'; 
            // if (userMenu) userMenu.style.display = 'none';
            
            // Clear current chat
            state.chat.currentChatId = null;
            localStorage.removeItem('currentChatId');

            // Clear messages and show welcome screen
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
                messagesContainer.style.display = 'none';
            }
            if (welcomeContainer) {
                welcomeContainer.style.display = 'flex';
            }
            if (chatInput) {
                chatInput.value = '';
            }
            // Clear API key on logout
            state.user.apiKey = '';
            localStorage.removeItem('geminiApiKey');
            if(apiKeyInput) apiKeyInput.value = '';

            // Reset models to default
            useDefaultModels(); 
            if(defaultModel) state.settings.model = defaultModel.value;
            if(modelSelector) modelSelector.value = state.settings.model;
            
            // Clear gems from input area
            if (inputGemsContainer) {
                inputGemsContainer.innerHTML = '';
                inputGemsContainer.style.display = 'none';
            }
            state.selectedSystemPrompt = null;
        });


    }
    
    // Add event listeners for suggestion pills
    const suggestionPills = document.querySelectorAll('.suggestion-pill:not(.more)');
    suggestionPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const suggestion = pill.querySelector('span:last-child').textContent;
            chatInput.value = suggestion;
            chatInput.focus();
        });


    });


    
    // Add event listener for "New Chat" button (+) in sidebar header
    const newChatBtn = document.querySelector('.sidebar-header .btn-icon[title="New Chat"]'); // Fixed selector

// --- CHAT MESSAGE HANDLING ---
async function handleSendMessage() {
    if (!state.user.apiKey) {
        alert('Please configure your API Key in settings before sending a message.');
        return;
    }
    const userMessageContent = chatInput.value.trim();
    if (!userMessageContent) return;

    // Transform UI from welcome to chat if this is the first message
    if (welcomeContainer && welcomeContainer.style.display !== 'none') {
        // Apply transition effect
        welcomeContainer.style.opacity = '0';
        welcomeContainer.style.transition = 'opacity 0.3s ease';
        
        // After transition completes, hide welcome and show chat
        setTimeout(() => {
            welcomeContainer.style.display = 'none';
            if (messagesContainer) {
                messagesContainer.style.display = 'flex';
                messagesContainer.style.opacity = '0';
                // Fade in the messages container
                setTimeout(() => {
                    messagesContainer.style.opacity = '1';
                    messagesContainer.style.transition = 'opacity 0.3s ease';
                }, 50);
            }
            
            // Adjust the chat input wrapper styling for chat view
            const chatInputWrapper = document.querySelector('.chat-input-wrapper');
            if (chatInputWrapper) {
                chatInputWrapper.classList.add('messages-view');
            }
        }, 300);
    }

    // Add message to UI immediately
    addMessageToUI('user', userMessageContent); 
    chatInput.value = ''; 
    
    // Disable the input field and send button while preparing the request
    if (sendBtn) sendBtn.disabled = true;
    if (chatInput) chatInput.disabled = true;

    try {
        let currentChatId = state.chat.currentChatId;
        let isNewChat = false;

        // If no current chat ID, create a new chat in Firebase/localStorage
        if (!currentChatId) {
            isNewChat = true;
            // Common words to exclude from chat titles
            const commonWords = new Set([
                'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 
                'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 
                'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 
                'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 
                'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'please',
                'could', 'would', 'should', 'might', 'must', 'shall', 'may', 'can', 'will', 'would'
            ]);
            
            // Get words, filter out common words, and take first 4 meaningful words
            const words = userMessageContent
                .trim()
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 0 && !commonWords.has(word));
            
            let chatTitle;
            console.log(`No current chat. Attempting to create a new Firebase chat with title from words:`, words);
            
            if (words.length >= 5) {
                // Take first 5 meaningful words and capitalize first letter of each
                chatTitle = words
                    .slice(0, 5)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            } else if (words.length > 0) {
                // If less than 5 meaningful words, use what we have
                chatTitle = words
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            } else {
                // Fallback if no meaningful words found
                chatTitle = 'New Chat';
            }
            
            // Create a new chat in Firebase with fallback to localStorage
            currentChatId = await createFirebaseChat(chatTitle);
            state.chat.currentChatId = currentChatId;
            localStorage.setItem('currentChatId', currentChatId);
            console.log(`New chat created with ID: ${currentChatId}, Title: "${chatTitle}"`);
        }

        // Save user message to Firebase in the background
        addFirebaseChatMessage(currentChatId, {
            sender: 'user',
            content: userMessageContent
        }).catch(error => {
            console.error('Background save of user message failed:', error);
        });

        // Show thinking indicator before the API request
        showThinkingIndicator();
        
        try {
            // Get AI response - the streaming implementation now adds the message to UI itself
            const aiResponse = await getGeminiResponse(userMessageContent);

            if (aiResponse) { // Ensure there's a response to display
                addMessageToUI('ai', aiResponse);
                
                // Save AI response to Firebase in the background
                addFirebaseChatMessage(currentChatId, {
                    sender: 'ai',
                    content: aiResponse
                }).catch(error => {
                    console.error('Background save of AI response failed:', error);
                });
            }
            
            // Reload chat history in the background
            loadChatHistory().catch(error => {
                console.error('Background chat history reload failed:', error);
            });
            
            // Update UI in the next tick to keep things responsive
            requestAnimationFrame(() => {
                // Highlight the current chat
                const chatItems = document.querySelectorAll('#chatHistoryList li');
                chatItems.forEach(item => {
                    if (item.dataset.chatId === currentChatId) {
                        item.classList.add('active');
                    } else {
                        item.classList.remove('active');
                    }
                });
            });
        } catch (error) {
            console.error('Error getting AI response:', error);
            addMessageToUI('system', `Error: ${error.message || 'Failed to get AI response'}`);
        }



    } catch (error) {
        console.error('Error in handleSendMessage:', error);
        addMessageToUI('system', `Error: ${error.message || 'Could not process message.'}`);
    } finally {
        hideThinkingIndicator();
        // Re-enable the input field and send button
        if (sendBtn) sendBtn.disabled = false;
        if (chatInput) chatInput.disabled = false;
    }
}

// Add Message to UI
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${role}-message`);
    
    // Avatar logic (simplified, ensure images are accessible from new_chat.html too)
    const avatarImg = document.createElement('img');
    if (role === 'ai') {
        avatarImg.src = 'images/blackhole.png'; // Path relative to current HTML file
        avatarImg.alt = 'Singularity';
    } else { // user
        // Use dynamic avatar for user based on state.user.name
        const userNameForAvatar = state.user.name || 'User'; // Fallback if name isn't loaded yet
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNameForAvatar)}&background=333&color=fff`;
        avatarImg.alt = userNameForAvatar;
        avatarImg.onerror = function() { this.src = 'images/avatar-placeholder.png'; }; // Fallback
    }
    
    const messageAvatarDiv = document.createElement('div');
    messageAvatarDiv.className = 'message-avatar';
    messageAvatarDiv.appendChild(avatarImg);
    
    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';
    
    // Add a header with the sender name
    const senderName = document.createElement('div');
    senderName.className = 'message-sender';
    senderName.textContent = role === 'ai' ? 'Singularity' : (state.user.name || 'You');
    
    // Add the message content with Markdown and MathJax rendering
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-text';
    
    // Only parse markdown for AI messages, but render LaTeX for both AI and user messages
    if (role === 'ai') {
        // Check if the content is likely pre-formatted HTML for an image or document
        if (typeof content === 'string' && (
            content.startsWith('<div class="generated-image-container">') ||
            content.startsWith('<div class="generated-document-container">')
        )) {
            contentDiv.innerHTML = content; // Directly insert HTML for images and documents
        } else {
            // Convert markdown to HTML using marked.js for text messages
            contentDiv.innerHTML = marked.parse(content);
            
            // Process any code blocks with Prism.js for syntax highlighting
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                Prism.highlightElement(block);
            });
        }


    } else {
        // For user messages, just render the content directly without markdown parsing
        contentDiv.innerHTML = content;
    }
    
    // Trigger MathJax to render any LaTeX equations for both AI and user messages
    setTimeout(() => {
        if (window.MathJax) {
            try {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, contentDiv]);
            } catch (err) {
                console.error('MathJax typesetting failed:', err);
            }
        }
    }, 0);

    // Image download functionality - applied to contentDiv
    const imageContainerInContentDiv = contentDiv.querySelector('.generated-image-container');
    if (imageContainerInContentDiv) {
        const imageInContentDiv = imageContainerInContentDiv.querySelector('.generated-image');
        if (imageInContentDiv) {
            // Function to add download button to image
            const addDownloadButton = function() {
                // Prevent adding multiple download buttons
                if (imageContainerInContentDiv.querySelector('.image-actions')) {
                    return;
                }
                
                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('image-actions');

                const downloadBtn = document.createElement('button');
                downloadBtn.classList.add('image-download-btn');
                downloadBtn.innerHTML = '<span class="material-symbols-rounded">download</span> Download';
                downloadBtn.onclick = function() {
                    const link = document.createElement('a');
                    link.href = imageInContentDiv.src;
                    link.download = 'generated-image-' + Date.now() + '.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                };

                actionsDiv.appendChild(downloadBtn);
                imageContainerInContentDiv.appendChild(actionsDiv);
            };
            
            // Set up the onload handler
            imageInContentDiv.onload = addDownloadButton;
            
            // For images that are already loaded or loading from cache
            if (imageInContentDiv.complete) {
                // If image is already fully loaded
                if (imageInContentDiv.naturalHeight !== 0) {
                    // Add download button immediately
                    addDownloadButton();
                } else {
                    // For broken images, set a small timeout to check again
                    // This helps with images that report complete but aren't actually loaded yet
                    setTimeout(() => {
                        if (imageInContentDiv.naturalHeight !== 0) {
                            addDownloadButton();
                        }
                    }, 100);
                }
            }
        }
    }

    // New structure for appending senderName, contentDiv, and copy button for AI messages
    if (role === 'ai') {
        const messageHeaderDiv = document.createElement('div');
        messageHeaderDiv.className = 'message-header'; // CSS: display: flex; justify-content: space-between; align-items: center;
        messageHeaderDiv.style.display = 'flex';
        messageHeaderDiv.style.justifyContent = 'space-between';
        messageHeaderDiv.style.alignItems = 'center';
        messageHeaderDiv.style.marginBottom = '4px'; // Space between header and content

        messageHeaderDiv.appendChild(senderName); // senderName is already created

        // --- Copy Button Logic ---
        const messageActionsDiv = document.createElement('div');
        messageActionsDiv.className = 'message-actions';
        messageActionsDiv.style.position = 'relative'; // For dropdown positioning
        messageActionsDiv.style.marginLeft = '10px'; // Add some space between sender name and button

        // Create a dark-themed, translucent copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn icon-btn';
        copyBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px;">content_copy</span>';
        copyBtn.title = 'Copy message';
        copyBtn.style.background = 'rgba(40, 44, 52, 0.6)'; // Dark translucent background
        copyBtn.style.backdropFilter = 'blur(4px)'; // Blur effect for glass-like appearance
        copyBtn.style.WebkitBackdropFilter = 'blur(4px)'; // For Safari support
        copyBtn.style.border = 'none';
        copyBtn.style.borderRadius = '4px';
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.padding = '5px 8px';
        copyBtn.style.color = 'rgba(255, 255, 255, 0.85)'; // Slightly translucent white text
        copyBtn.style.display = 'flex';
        copyBtn.style.alignItems = 'center';
        copyBtn.style.justifyContent = 'center';
        copyBtn.style.transition = 'all 0.2s ease';
        copyBtn.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)'; // Subtle shadow
        copyBtn.onmouseenter = () => {
            copyBtn.style.background = 'rgba(60, 64, 72, 0.8)'; // Darker, more opaque on hover
            copyBtn.style.color = '#ffffff'; // Full white on hover
        };
        copyBtn.onmouseleave = () => {
            copyBtn.style.background = 'rgba(40, 44, 52, 0.6)';
            copyBtn.style.color = 'rgba(255, 255, 255, 0.85)';
        };

        // Create a dark, translucent dropdown menu to match the button
        const copyOptionsDiv = document.createElement('div');
        copyOptionsDiv.className = 'copy-options';
        copyOptionsDiv.style.display = 'none';
        copyOptionsDiv.style.position = 'absolute';
        copyOptionsDiv.style.right = '0';
        copyOptionsDiv.style.top = 'calc(100% + 5px)'; // Position below with a gap
        copyOptionsDiv.style.backgroundColor = 'rgba(30, 33, 40, 0.85)'; // Dark translucent background
        copyOptionsDiv.style.backdropFilter = 'blur(8px)'; // Stronger blur for glass effect
        copyOptionsDiv.style.WebkitBackdropFilter = 'blur(8px)'; // For Safari support
        copyOptionsDiv.style.border = '1px solid rgba(70, 70, 70, 0.5)';
        copyOptionsDiv.style.borderRadius = '8px';
        copyOptionsDiv.style.padding = '8px';
        copyOptionsDiv.style.zIndex = '1000'; // Higher z-index to ensure it's above other content
        copyOptionsDiv.style.minWidth = '180px';
        copyOptionsDiv.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
        copyOptionsDiv.style.transform = 'translateY(0)'; // Start position for animation
        copyOptionsDiv.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        copyOptionsDiv.style.opacity = '0';

        // Create plaintext button with icon - dark theme
        const copyPlaintextBtn = document.createElement('button');
        copyPlaintextBtn.className = 'copy-option-btn';
        copyPlaintextBtn.style.display = 'flex';
        copyPlaintextBtn.style.alignItems = 'center';
        copyPlaintextBtn.style.width = '100%';
        copyPlaintextBtn.style.padding = '8px 10px';
        copyPlaintextBtn.style.textAlign = 'left';
        copyPlaintextBtn.style.background = 'rgba(50, 55, 65, 0.4)'; // Slightly lighter than dropdown bg
        copyPlaintextBtn.style.border = 'none';
        copyPlaintextBtn.style.borderRadius = '6px';
        copyPlaintextBtn.style.cursor = 'pointer';
        copyPlaintextBtn.style.color = 'rgba(255, 255, 255, 0.9)'; // Almost white text
        copyPlaintextBtn.style.fontSize = '14px';
        copyPlaintextBtn.style.marginBottom = '6px';
        copyPlaintextBtn.style.transition = 'all 0.15s ease';
        copyPlaintextBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px; margin-right: 8px; color: rgba(255, 255, 255, 0.7);">text_format</span> Copy Plaintext';

        // Create markdown button with icon - dark theme
        const copyMarkdownBtn = document.createElement('button');
        copyMarkdownBtn.className = 'copy-option-btn';
        copyMarkdownBtn.style.display = 'flex';
        copyMarkdownBtn.style.alignItems = 'center';
        copyMarkdownBtn.style.width = '100%';
        copyMarkdownBtn.style.padding = '8px 10px';
        copyMarkdownBtn.style.textAlign = 'left';
        copyMarkdownBtn.style.background = 'rgba(50, 55, 65, 0.4)'; // Slightly lighter than dropdown bg
        copyMarkdownBtn.style.border = 'none';
        copyMarkdownBtn.style.borderRadius = '6px';
        copyMarkdownBtn.style.cursor = 'pointer';
        copyMarkdownBtn.style.color = 'rgba(255, 255, 255, 0.9)'; // Almost white text
        copyMarkdownBtn.style.fontSize = '14px';
        copyMarkdownBtn.style.transition = 'all 0.15s ease';
        copyMarkdownBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 16px; margin-right: 8px; color: rgba(255, 255, 255, 0.7);">code</span> Copy Markdown';

        [copyPlaintextBtn, copyMarkdownBtn].forEach(btn => {
            btn.onmouseenter = () => {
                btn.style.backgroundColor = 'rgba(70, 80, 95, 0.7)';
                btn.style.color = '#ffffff';
                const icon = btn.querySelector('.material-symbols-rounded');
                if (icon) icon.style.color = '#ffffff';
            };
            btn.onmouseleave = () => {
                btn.style.backgroundColor = 'rgba(50, 55, 65, 0.4)';
                btn.style.color = 'rgba(255, 255, 255, 0.9)';
                const icon = btn.querySelector('.material-symbols-rounded');
                if (icon) icon.style.color = 'rgba(255, 255, 255, 0.7)';
            };
        });

        copyOptionsDiv.appendChild(copyPlaintextBtn);
        copyOptionsDiv.appendChild(copyMarkdownBtn);
        
        messageActionsDiv.appendChild(copyBtn);
        messageActionsDiv.appendChild(copyOptionsDiv);

        copyBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Important to prevent immediate close by document listener
            const isCurrentlyHidden = copyOptionsDiv.style.display === 'none';
            
            // Hide all other open copy options menus first
            document.querySelectorAll('.message-actions .copy-options').forEach(opt => {
                if (opt !== copyOptionsDiv) { 
                    opt.style.display = 'none';
                    opt.style.opacity = '0';
                    opt.style.transform = 'translateY(0)';
                }
            });
            
            if (isCurrentlyHidden) {
                // Show the menu with animation
                copyOptionsDiv.style.display = 'block';
                // Use setTimeout to ensure the display:block takes effect before starting animation
                setTimeout(() => {
                    copyOptionsDiv.style.opacity = '1';
                    copyOptionsDiv.style.transform = 'translateY(5px)';
                }, 10);
            } else {
                // Hide with animation
                copyOptionsDiv.style.opacity = '0';
                copyOptionsDiv.style.transform = 'translateY(0)';
                // Wait for animation to complete before hiding
                setTimeout(() => {
                    copyOptionsDiv.style.display = 'none';
                }, 200);
            }
        });

        copyPlaintextBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const plainText = contentDiv.innerText; // contentDiv holds the rendered message
            navigator.clipboard.writeText(plainText)
                .then(() => showToast('Copied as plaintext!'))
                .catch(err => {
                    console.error('Failed to copy plaintext:', err);
                    showToast('Failed to copy plaintext.', 'error');
                });
            copyOptionsDiv.style.display = 'none';
        });

        copyMarkdownBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            let markdownToCopy = content; // 'content' is the original parameter passed to addMessageToUI
            
            if (typeof content === 'string' && content.startsWith('<div class="generated-image-container">')) {
                const tempHtmlDiv = document.createElement('div');
                tempHtmlDiv.innerHTML = content;
                const imgTag = tempHtmlDiv.querySelector('.generated-image');
                if (imgTag && imgTag.src) {
                    markdownToCopy = `![Generated Image](${imgTag.src})`;
                } else {
                    markdownToCopy = content; // Fallback to copying the HTML if src not found
                }
            }

            navigator.clipboard.writeText(markdownToCopy)
                .then(() => showToast('Copied as Markdown!'))
                .catch(err => {
                    console.error('Failed to copy Markdown:', err);
                    showToast('Failed to copy Markdown.', 'error');
                });
            copyOptionsDiv.style.display = 'none';
        });
        
        messageHeaderDiv.appendChild(messageActionsDiv);
        messageContentDiv.appendChild(messageHeaderDiv);
        // --- End Copy Button Logic ---
    } else { // For user messages, just append sender name as before
        messageContentDiv.appendChild(senderName);
    }

    messageContentDiv.appendChild(contentDiv); // Append the actual message text (contentDiv)

    // Add click event listener to close the copy options menu when clicking outside
    document.addEventListener('click', (event) => {
        const isClickInside = copyOptionsDiv.contains(event.target) || copyBtn.contains(event.target);
        if (!isClickInside && copyOptionsDiv.style.display === 'block') {
            copyOptionsDiv.style.opacity = '0';
            copyOptionsDiv.style.transform = 'translateY(0)';
            setTimeout(() => {
                copyOptionsDiv.style.display = 'none';
            }, 200);
        }
    });
    
    // Append avatar and content to the main message div
    if (role === 'ai') {
        messageDiv.appendChild(messageAvatarDiv);
        messageDiv.appendChild(messageContentDiv);
    } else { // user message
        messageDiv.appendChild(messageAvatarDiv);
        messageDiv.appendChild(messageContentDiv);
        // Add a custom class to fix user message alignment
        messageDiv.classList.add('user-message-container');
    }
    // The rest of the original problematic block (lines 980-1017) is removed by this replacement.
    // The function should continue after this to append messageDiv to the chat or return it.
    // Thinking indicator is now reliably handled by hideThinkingIndicator() in handleSendMessage's finally block.
    
    // Re-enable the send button
    if (sendBtn) {
        sendBtn.disabled = false;
        const sendIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M0 0h24v24H0z" fill="none"/><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        sendBtn.innerHTML = sendIconSVG;
    }
    
    // Re-enable the input
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.focus();
    }
    
    // CRITICAL FIX: Append the message to the chat container
    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
        // Make sure the chat container is visible
        chatMessages.style.display = 'block';
        
        // Append the message
        chatMessages.appendChild(messageDiv);
        
        // Hide the welcome container when chat starts
        const welcomeContainer = document.querySelector('.welcome-container');
        if (welcomeContainer) {
            welcomeContainer.style.display = 'none';
        }
        
        // Scroll to the bottom to show the new message
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
        console.error('Chat messages container not found');
    }
}

// Thinking Indicator Functions
function showThinkingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    // Remove existing indicator if any, to prevent duplicates and ensure it's fresh
    const existingIndicator = document.getElementById('thinking-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    const indicatorDiv = document.createElement('div');
    indicatorDiv.id = 'thinking-indicator'; 
    indicatorDiv.classList.add('message', 'ai-message', 'thinking-indicator-container');

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = 'images/blackhole.png'; 
    avatarImg.alt = 'Singularity';
    avatarDiv.appendChild(avatarImg);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const senderName = document.createElement('div');
    senderName.className = 'message-sender';
    senderName.textContent = 'Singularity';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = 'Thinking... <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';

    contentDiv.appendChild(senderName);
    contentDiv.appendChild(textDiv);
    
    indicatorDiv.appendChild(avatarDiv);
    indicatorDiv.appendChild(contentDiv);

    chatMessages.appendChild(indicatorDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

function hideThinkingIndicator() {
    const indicatorElement = document.getElementById('thinking-indicator'); 
    if (indicatorElement) {
        indicatorElement.remove();
    }
}

// --- Gemini Model Fetching and Selection ---

// Fetch models from Gemini API
async function fetchGeminiModels() {
    if (!state.user.apiKey) {
        console.warn('No API key set. Cannot fetch models.');
        useDefaultModels(); // Fallback if API key is missing
        return;
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${state.user.apiKey}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });


        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // Log the raw API response
        console.log('Raw models API response:', JSON.stringify(data, null, 2));
        
        // Filter models that support specific generation methods, exclude Gemma models, and remove duplicates
        const seenModels = new Set();
        const requiredMethods = new Set([
            'generateContent',
            'countTokens',
            'createCachedContent',
            'batchGenerateContent'
        ]);
        
        const generativeModels = data.models
            .filter(model => {
                const modelName = model.name || '';
                const baseModelId = model.baseModelId || '';
                const displayName = model.displayName || '';
                const supportedMethods = model.supportedGenerationMethods || [];
                
                // Skip Gemma models
                if (modelName.toLowerCase().includes('gemma') || 
                    baseModelId.toLowerCase().includes('gemma') ||
                    displayName.toLowerCase().includes('gemma')) {
                    return false;
                }
                
                // Only include models that support all required methods
                const hasAllRequiredMethods = Array.from(requiredMethods).every(method => 
                    supportedMethods.includes(method)
                );
                
                return hasAllRequiredMethods;
            })
            .filter(model => {
                // Remove duplicates based on baseModelId or name
                const modelId = (model.baseModelId || model.name || '').toLowerCase();
                if (!modelId || seenModels.has(modelId)) {
                    return false;
                }
                seenModels.add(modelId);
                return true;
            });


        
        // Log the filtered models
        console.log('Filtered models:', generativeModels.map(m => ({
            name: m.name,
            baseModelId: m.baseModelId,
            displayName: m.displayName
        })));
        
        // Update model selectors
        updateModelSelectors(generativeModels);
        
        // Store models in state
        state.availableModels = generativeModels;
        
    } catch (error) {
        console.error('Error fetching models:', error);
        showToast('Error fetching models. Using default list.');
        // Fallback to default models on API error
        useDefaultModels();
    }
}

// Function to update model selectors with fetched models
function updateModelSelectors(models) {
    // Create a Map to store models by their base name (without version/date)
    const modelGroups = new Map();
    
    // Process models and group them by base name
    models.forEach(model => {
        const modelId = model.name.replace('models/', '');
        // Use displayName if available, otherwise fallback to baseModelId or name
        let displayName = model.displayName || model.baseModelId || modelId;
        
        // Skip models with 'alias' in their display name (case insensitive)
        if (displayName.toLowerCase().includes('alias')) {
            return; // Skip this model
        }
        
        // Extract the core model family name by removing version numbers and other suffixes
        let baseName = displayName.trim();
        
        // Remove any version numbers (e.g., "001", "1.0")
        baseName = baseName.replace(/\s+\d{3,}(?:\.\d+)?\b/g, '');
        
        // Remove common suffixes
        const suffixesToRemove = [
            '-lite', 'preview', 'experimental', 'latest', 'for cursor testing',
            'for testing', 'test', 'beta', 'alpha', 'rc', 'release candidate'
        ];
        
        suffixesToRemove.forEach(suffix => {
            const pattern = new RegExp(`\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
            baseName = baseName.replace(pattern, ' ');
        });
        
        // Clean up any remaining whitespace and special characters
        baseName = baseName.replace(/\s+/g, ' ').trim();
        baseName = baseName.replace(/[_-]+/g, ' ').trim();
        
        // If we haven't seen this base name before, add it
        if (!modelGroups.has(baseName)) {
            modelGroups.set(baseName, []);
        }
        
        // Add this model to its group with complexity score (lower is simpler)
        const complexityScore = calculateModelComplexity(displayName);
        
        modelGroups.get(baseName).push({
            id: modelId,
            fullName: displayName,
            baseName: baseName,
            complexityScore: complexityScore
        });
    });
    
    // Helper function to calculate model name complexity
    function calculateModelComplexity(name) {
        // Simpler names are better - prefer shorter names with fewer special characters
        let score = name.length; // Start with length as base score
        
        // Penalize certain patterns that indicate less common variants
        if (/\d{3,}/.test(name)) score += 20; // Version numbers
        if (/[-_]/.test(name)) score += 15;   // Special characters
        if (/preview|experimental|beta|alpha|rc|test/i.test(name)) score += 25;
        
        return score;
    }
    
    // Select the best model from each group
    const uniqueModels = new Map();
    
    modelGroups.forEach((models, baseName) => {
        // If there's only one model in this group, use it
        if (models.length === 1) {
            const model = models[0];
            uniqueModels.set(model.id, { id: model.id, name: model.fullName });
            return;
        }
        
        // Sort models by complexity (simplest first)
        models.sort((a, b) => a.complexityScore - b.complexityScore);
        
        // Always prefer the simplest model name in the group
        const bestModel = models[0];
        
        uniqueModels.set(bestModel.id, { id: bestModel.id, name: bestModel.fullName });
    });
    
    // Convert the unique models back to an array of HTML options
    const modelOptions = Array.from(uniqueModels.values())
        .map(model => `<option value="${model.id}">${model.name}</option>`)
        .join('');
    
    const currentSelectedModel = state.settings.model; // Get the currently stored model
    
    // Update both model selectors
    if (modelSelector) {
        modelSelector.innerHTML = modelOptions;
        // Try to restore previous selection, or select the first available
        
        // First try exact ID match
        if (uniqueModels.has(currentSelectedModel)) {
            modelSelector.value = currentSelectedModel;
        } 
        // Then try partial match (model ID might be part of the full model name)
        else {
            const partialMatch = Array.from(uniqueModels.keys()).find(id => 
                id.includes(currentSelectedModel) || currentSelectedModel.includes(id));
            
            if (partialMatch) {
                modelSelector.value = partialMatch;
            } else if (modelSelector.options.length > 0) {
                modelSelector.value = modelSelector.options[0].value;
                state.settings.model = modelSelector.options[0].value; // Update state if changed
                localStorage.setItem('defaultModel', state.settings.model);
            }
        }
    }
    
    if (defaultModel) {
        defaultModel.innerHTML = modelOptions;
        // Try to restore previous selection, or select the first available
        
        // First try exact ID match
        if (uniqueModels.has(currentSelectedModel)) {
            defaultModel.value = currentSelectedModel;
        } 
        // Then try partial match (model ID might be part of the full model name)
        else {
            const partialMatch = Array.from(uniqueModels.keys()).find(id => 
                id.includes(currentSelectedModel) || currentSelectedModel.includes(id));
            
            if (partialMatch) {
                defaultModel.value = partialMatch;
            } else if (defaultModel.options.length > 0) {
                defaultModel.value = defaultModel.options[0].value;
            }
        }
    }
}

// Fallback function for default models
function useDefaultModels() {
    const defaultModels = [
        { name: 'models/gemini-2.5-pro-preview-05-06', displayName: 'Gemini 2.5 Pro Preview', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-1.0-pro', displayName: 'Gemini 1.0 Pro', supportedGenerationMethods: ['generateContent'] }
    ];
    
    updateModelSelectors(defaultModels);
    // Ensure the state reflects one of these default models
    if (!state.settings.model || !defaultModels.some(m => m.name.includes(state.settings.model))) {
        state.settings.model = defaultModels[0].name.replace('models/', '');
        localStorage.setItem('defaultModel', state.settings.model);
    }
}

// Save settings to Firestore and localStorage
async function saveSettings() {
    console.log("Saving settings...", {
        user_id: state.userId,
        api_key: state.user.apiKey ? '************' : 'N/A', // Don't log full key
        default_model: state.settings.model,
        theme: state.settings.theme
    });
    
    // Save to localStorage for immediate use
    localStorage.setItem('geminiApiKey', state.user.apiKey);
    localStorage.setItem('defaultModel', state.settings.model);
    localStorage.setItem('theme', state.settings.theme);
    
    // If user is authenticated, save to Firestore
    if (state.isAuthenticated && state.userId) {
        try {
            showLoadingScreen(); // Show loading screen during Firebase operation
            
            const userDocRef = doc(db, 'users', state.userId);
            
            // First check if the document exists
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                // Update existing document
                await updateDoc(userDocRef, {
                    apiKey: state.user.apiKey,
                    defaultModel: state.settings.model,
                    theme: state.settings.theme,
                    lastUpdated: serverTimestamp()
                });
                console.log('Settings updated in Firestore successfully');
            } else {
                // Create new document with user data
                const currentUser = auth.currentUser;
                const userData = {
                    apiKey: state.user.apiKey,
                    defaultModel: state.settings.model,
                    theme: state.settings.theme,
                    email: currentUser ? currentUser.email : state.user.email,
                    name: currentUser ? (currentUser.displayName || state.user.name) : state.user.name,
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                };
                
                await setDoc(userDocRef, userData);
                console.log('New user document created in Firestore successfully');
            }
            
            showToast('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Error saving settings to Firestore:', error);
            showToast('Error saving settings', 'error');
        } finally {
            hideLoadingScreen(); // Hide loading screen when done
        }
    } else {
        console.log('User not authenticated, settings saved to localStorage only');
        showToast('Settings saved locally', 'success');
    }
}

// Show Toast Message
function showToast(message, duration = 3000) {
    console.log(`Attempting to show toast: "${message}"`); // Debug log
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) { // Remove any existing toast immediately
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Force reflow to ensure transition applies correctly from initial state and for offsetWidth calculation
    void toast.offsetWidth; 

    // Show toast by adding class
    setTimeout(() => { // Short delay to ensure it's rendered before class change for transition
        toast.classList.add('show');
    }, 50); 

    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) { // Simpler check if still in DOM
                toast.remove();
            }
        }, 500); // Wait for fade out transition (should match CSS transition duration)
    }, duration);
}

// --- Gemini API Chat Completion with Streaming ---
async function getGeminiResponse(userMessage) {
    if (!state.user.apiKey) {
        console.error('API Key is missing. Cannot make API call.');
        hideThinkingIndicator();
        return 'API Key not configured. Please set it in settings.'; 
    }
    
    // This function will now return the content string, not manipulate DOM directly.
    // The thinking indicator is handled by the caller (handleSendMessage).
    // console.log('getGeminiResponse called with message:', userMessage);

    // Get selected model
    const modelToUse = state.settings.model.startsWith('models/') ? state.settings.model : `models/${state.settings.model}`;
    const apiKey = state.user.apiKey;
    
    // First, try a standard (non-streaming) request which is more reliable
    const regularURL = `https://generativelanguage.googleapis.com/v1beta/${modelToUse}:generateContent?key=${apiKey}`;
    
    // Build the request body with message contents and chat history
    let requestContents = [];
    
    // Include chat history if available
    if (state.chat.currentChatId && state.chat.messages && state.chat.messages.length > 0) {
        // Convert the chat history to the format expected by the Gemini API
        state.chat.messages.forEach(msg => {
            // Map 'user' to 'user' and 'ai' to 'model' roles for Gemini API
            const role = msg.sender === 'user' ? 'user' : 'model';
            
            // Skip messages that are just images or filter out image content
            let messageContent = msg.content;
            
            // Check if the message contains image HTML
            if (messageContent.includes('<div class="generated-image-container">')) {
                // If it's purely an image message (or very close to it), skip this message entirely
                if (messageContent.trim().startsWith('<div class="generated-image-container">') && 
                    messageContent.indexOf('</div>') > messageContent.length - 20) {
                    return; // Skip this message
                }
                
                // Otherwise, replace image HTML with a placeholder
                messageContent = messageContent.replace(
                    /<div class="generated-image-container">.*?<\/div>/gs, 
                    '[IMAGE: Generated image was displayed here]'
                );
            }
            
            // Create a content object for each message
            requestContents.push({
                role: role,
                parts: [{ text: messageContent }]
            });
        });
    }
    
    // Add the current user message, including file (image or PDF) if available
    if (state.chat.fileData && state.chat.fileType) {
        // Create a message with both file and text
        const parts = [
            {
                inlineData: {
                    data: state.chat.fileData,
                    mimeType: state.chat.fileType
                }
            }
        ];
        
        // Add text if provided
        if (userMessage && userMessage.trim() !== '') {
            parts.push({ text: userMessage });
        }
        
        requestContents.push({
            role: 'user',
            parts: parts
        });
        
        // Clear the file data after sending
        state.chat.fileData = null;
        state.chat.fileType = null;
        state.chat.fileFormat = null;
        
        // Remove the file preview
        const filePreview = document.querySelector('.file-preview-container');
        if (filePreview) {
            filePreview.remove();
        }
    } else {
        // Text-only message
        requestContents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });
    }
    
    const requestBody = {
        generationConfig: confignew.generationConfig,
        contents: requestContents
    };
    
    // Add system instruction if a gem is selected
    if (state.selectedSystemPrompt) {
        // Use the format that works with the Gemini API
        requestBody.systemInstruction = {
            role: "system",
            parts: [{"text": state.selectedSystemPrompt }]
        };
    }
    
    // Build the tools array dynamically based on which tools are enabled in state
    const functionDeclarations = [];
    
    // Add image generation tool if enabled
    if (state.enabledTools.imageGeneration && typeof imageGenerationTool !== 'undefined') {
        functionDeclarations.push(imageGenerationTool);
    }
    
    // Add document generation tool if enabled
    if (state.enabledTools.documentGeneration && typeof documentGenerationTool !== 'undefined') {
        functionDeclarations.push(documentGenerationTool);
    }
    
    // Create the tools array for the request body
    const tools = [];
    
    // Add function declarations if any exist
    if (functionDeclarations.length > 0) {
        tools.push({ functionDeclarations: functionDeclarations });
    }
    
    // Add web search if enabled
    if (state.enabledTools.webSearch) {
        tools.push({ googleSearch: {} });
    }
    
    // Add website browsing if enabled
    if (state.enabledTools.websiteBrowsing) {
        tools.push({ urlContext: {} });
    }
    
    // Only add the tools property to the request if there are any tools enabled
    if (tools.length > 0) {
        requestBody.tools = tools;
    }
    
    console.log('Request tools configuration:', tools);

    try {
        // Check if this is an image generation request
        if (userMessage.toLowerCase().includes('/image')) {
            // Extract the prompt after the /image command
            const imagePrompt = userMessage.replace(/\/image\s*/i, '').trim();
            if (!imagePrompt) {
                return "Please provide a description after the /image command. For example: /image sunset over mountains";
            }
            
            // Generate the image using the same API key as the chat
            const result = await generateImage(imagePrompt, apiKey);
            
            // If we have an image URL, create an HTML response with the image and download button
            if (result.imageUrl) {
                return createImageResultHTML(result.imageUrl, result.text, imagePrompt);
            } else {
                return result.text || "I couldn't generate an image. Please try a different prompt.";
            }
        }

        // Start with a standard request which is more reliable
        const response = await fetch(regularURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });


        console.log('API request sent:', requestBody);
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        
        // Process the response
        const data = await response.json();
        console.log('API response received:', data);
        
        // Check if the model wants to use a tool - Handle different possible formats
        // Format 1: Standard toolCalls format
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.toolCalls && 
            data.candidates[0].content.toolCalls.length > 0) {
            
            console.log('Tool calls detected (format 1):', data.candidates[0].content.toolCalls);
            
            // Process the tool calls
            const toolResponses = await processToolCalls(data.candidates[0].content.toolCalls, apiKey);
            
            if (toolResponses && toolResponses.length > 0) {
                // If we have image generation results
                const imageToolResponse = toolResponses.find(r => r.name === 'generateImage');
                
                if (imageToolResponse && imageToolResponse.content.imageUrl) {
                    // Hide thinking indicator
                    hideThinkingIndicator();
                    
                    // Format the image response
                    return createImageResultHTML(imageToolResponse.content.imageUrl, imageToolResponse.content.text, userMessage.replace(/\/image\s*/i, '').trim());
                }
                
                // If we have document generation results
                const documentToolResponse = toolResponses.find(r => r.name === 'generateDocument');
                
                if (documentToolResponse) {
                    // Hide thinking indicator
                    hideThinkingIndicator();
                    
                    // Check if we have HTML content directly from the tool response
                    if (documentToolResponse.content.html) {
                        // Use the HTML directly
                        return documentToolResponse.content.html;
                    } else if (documentToolResponse.content.documentUrl) {
                        // If we still get the old format response for backward compatibility
                        return createDocumentResultHTML(
                            documentToolResponse.content.documentUrl,
                            documentToolResponse.content.text || 'Here\'s the document I generated based on your content:',
                            userMessage.replace(/\/document\s*/i, '').trim()
                        );
                    } else if (documentToolResponse.content.error) {
                        // Handle error in document generation
                        return `I encountered an error while generating the document: ${documentToolResponse.content.error}. Please try again with different content.`;
                    }
                } else if (imageToolResponse && imageToolResponse.content.error) {
                    // Handle error in image generation
                    hideThinkingIndicator();
                    return `I encountered an error while generating the image: ${imageToolResponse.content.error}. Please try a different prompt.`;
                }
            }
        }
        // Format 2: Function call in parts array
        else if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            // Check if any part has a functionCall
            const functionCallPart = data.candidates[0].content.parts.find(part => part.functionCall);
            
            if (functionCallPart && functionCallPart.functionCall) {
                console.log('Function call detected (format 2):', functionCallPart.functionCall);
                
                // Create a tool call object in the format our processor expects
                const toolCall = {
                    functionCall: functionCallPart.functionCall
                };
                
                // Process the tool call
                const toolResponses = await processToolCalls([toolCall], apiKey);
                
                if (toolResponses && toolResponses.length > 0) {
                    // If we have image generation results
                    const imageToolResponse = toolResponses.find(r => r.name === 'generateImage');
                    
                    if (imageToolResponse && imageToolResponse.content.imageUrl) {
                        // Hide thinking indicator
                        hideThinkingIndicator();
                        
                        // Get the prompt from the function call args
                        let imagePrompt = "";
                        if (functionCallPart.functionCall.args && functionCallPart.functionCall.args.prompt) {
                            imagePrompt = functionCallPart.functionCall.args.prompt;
                        }
                        
                        // Use the consistent createImageResultHTML function
                        return createImageResultHTML(
                            imageToolResponse.content.imageUrl,
                            imageToolResponse.content.text || 'Here\'s the image I generated based on your prompt:',
                            imagePrompt
                        );
                    }
                    
                    // Handle document generation results from Format 2
                    const documentToolResponse = toolResponses.find(r => r.name === 'generateDocument');
                    
                    if (documentToolResponse) {
                        // Hide thinking indicator
                        hideThinkingIndicator();
                        
                        // Check if we have HTML content directly from the tool response
                        if (documentToolResponse.content.html) {
                            // Use the HTML directly
                            return documentToolResponse.content.html;
                        } else if (documentToolResponse.content.documentUrl) {
                            // Get the content from the function call args
                            let documentContent = "";
                            if (functionCallPart.functionCall.args && functionCallPart.functionCall.args.content) {
                                documentContent = functionCallPart.functionCall.args.content;
                            }
                            
                            // If we still get the old format response for backward compatibility
                            return createDocumentResultHTML(
                                documentToolResponse.content.documentUrl,
                                documentToolResponse.content.text || 'Here\'s the document I generated based on your content:',
                                documentContent
                            );
                        } else if (documentToolResponse.content.error) {
                            // Handle error in document generation
                            return `I encountered an error while generating the document: ${documentToolResponse.content.error}. Please try again with different content.`;
                        }
                    } else if (imageToolResponse && imageToolResponse.content.error) {
                        // Handle error in image generation
                        hideThinkingIndicator();
                        return `I encountered an error while generating the image: ${imageToolResponse.content.error}. Please try a different prompt.`;
                    }
                }
            }
        }
        
        // Check for direct image response format
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 1) {
            
            // Look for an image part
            const imagePart = data.candidates[0].content.parts.find(part => part.inlineData);
            const textPart = data.candidates[0].content.parts.find(part => part.text);
            
            if (imagePart && imagePart.inlineData) {
                // We have an image response
                console.log('Direct image response detected');
                
                // Create the image URL
                const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                const text = textPart ? textPart.text : 'Here\'s the image I generated based on your prompt:';
                
                // Extract a prompt from the text or use a default
                let imagePrompt = "image";
                if (textPart && textPart.text) {
                    // Try to extract a short prompt from the text
                    const promptMatch = textPart.text.match(/generate.*?(?:of|for|showing|depicting|with)\s+([^\n\.]+)/i);
                    if (promptMatch && promptMatch[1]) {
                        imagePrompt = promptMatch[1].trim();
                    }
                }
                
                // Thinking indicator will be hidden by the caller (handleSendMessage)
                
                // Return the image HTML
                return createImageResultHTML(imageUrl, text, imagePrompt);
            }
        }
        
        // Standard text response processing
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && 
            data.candidates[0].content.parts && 
            data.candidates[0].content.parts.length > 0) {
            
            // Get the full text response
            const text = data.candidates[0].content.parts[0].text || '';
            
            // Re-enable input controls - this should also be handled by the caller after the promise resolves.
            // if (sendBtn) sendBtn.disabled = false;
            // if (chatInput) {
            // chatInput.disabled = false;
            // chatInput.focus();
            // }
            
            // Return the full text response without simulated streaming
            return text;
        } else {
            // Handle empty or invalid response
            console.warn('Received an empty or invalid text response from the API.');
            return 'I received an empty or invalid response. Please try again.';
        }
    } catch (error) {
        // Handle any errors that occurred during the fetch
        console.error('Error connecting to Gemini API:', error);
        return `Error: ${error.message}`;
    }
}

// Helper function to split text into chunks to simulate streaming
function simulateStreamingChunks(text) {
    // Handle different types of content with different chunk sizes
    const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
    const nonCodeParts = text.split(/```[\s\S]*?```/);
    
    const chunks = [];
    
    for (let i = 0; i < nonCodeParts.length; i++) {
        // Process non-code part
        const part = nonCodeParts[i];
        if (part) {
            // Split non-code parts into smaller chunks (by sentences or small groups of words)
            const sentences = part.match(/[^.!?\n]+[.!?\n]+/g) || [part];
            for (const sentence of sentences) {
                // Further divide longer sentences
                if (sentence.length > 50) {
                    const words = sentence.split(' ');
                    let tempChunk = '';
                    
                    for (const word of words) {
                        tempChunk += word + ' ';
                        if (tempChunk.length > 30) {
                            chunks.push(tempChunk);
                            tempChunk = '';
                        }
                    }
                    
                    if (tempChunk) {
                        chunks.push(tempChunk);
                    }
                } else {
                    chunks.push(sentence);
                }
            }
        }
        
        // Add code block as a single chunk (don't split code blocks)
        if (i < codeBlocks.length) {
            chunks.push(codeBlocks[i]);
        }
    }
    
    return chunks;
}

// --- Optional: Model Info functions (not directly used in UI, but provided) ---
// Function to get model info for a specific model
async function getModelInfo(modelId) {
    if (!state.user.apiKey) {
        console.warn('No API key set. Cannot fetch model info.');
        return null;
    }
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}?key=${state.user.apiKey}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });


        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const modelInfo = await response.json();
        return modelInfo;
        
    } catch (error) {
        console.error(`Error fetching info for model ${modelId}:`, error);
        return null;
    }
}

// Example usage of getModelInfo (can be linked to a tooltip or modal)
function showModelDetails(modelId) {
    getModelInfo(modelId).then(info => {
        if (info) {
            console.log('Model Details:', info);
            let detailMessage = `**${info.displayName || info.name.replace('models/', '')}**\n`;
            detailMessage += `Description: ${info.description || 'N/A'}\n`;
            detailMessage += `Input Tokens: ${info.inputTokenLimit}\n`;
            detailMessage += `Output Tokens: ${info.outputTokenLimit}\n`;
            detailMessage += `Supported Methods: ${info.supportedGenerationMethods.join(', ')}`;
            // You can replace showToast with a custom modal for richer display
            showToast(detailMessage); // Or use a custom pop-up/modal
        } else {
            showToast(`Could not fetch details for model: ${modelId}`);
        }
    });


}
// You could add an event listener to the modelSelector if you wanted to trigger `showModelDetails` on change or hover.


// Initialize the app when the DOM is fully loaded

// --- CHAT HISTORY FUNCTIONS ---

async function loadChatHistory() {
    if (!chatHistoryList) {
        console.warn('chatHistoryList element not found. Cannot load chat history.');
        return;
    }

    console.log('Attempting to load chat history...');
    chatHistoryList.innerHTML = ''; // Clear existing list

    try {
        // Try to load chats from Firebase first, with fallback to localStorage
        const chats = await getFirebaseChats();
        console.log(`Found ${chats.length} chats.`);
        
        if (chats.length === 0) {
            console.log('No chat history found. Displaying "No chats yet."');
            const noChatsItem = document.createElement('li');
            noChatsItem.textContent = 'No chats yet.';
            noChatsItem.classList.add('no-chats-message');
            chatHistoryList.appendChild(noChatsItem);
            return;
        }

        // Chats from Firebase are already sorted, but we'll sort again just to be sure
        chats.sort((a, b) => new Date(b.lastUpdatedAt) - new Date(a.lastUpdatedAt));

        console.log('Starting to populate chat history UI items...');
        chats.forEach((chat, index) => {
            const listItem = document.createElement('li');
            listItem.classList.add('chat-item'); // Apply the item class
            listItem.dataset.chatId = chat.id;

            const contentDiv = document.createElement('div');
            contentDiv.classList.add('chat-item-content');

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('chat-title'); // Apply the title class
            titleSpan.textContent = chat.title || `Untitled Chat ${chat.id.slice(-5)}`;
            contentDiv.appendChild(titleSpan);

            // Future: Add chat-preview span here if needed
            // const previewSpan = document.createElement('span');
            // previewSpan.classList.add('chat-preview');
            // previewSpan.textContent = 'Last message preview...'; // Placeholder
            // contentDiv.appendChild(previewSpan);

            listItem.appendChild(contentDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('chat-actions');

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️'; // Use innerHTML for emoji icon
            deleteBtn.classList.add('delete-chat-btn'); // Existing class for delete functionality
            deleteBtn.classList.add('btn-icon'); // CSS class for icon buttons
            deleteBtn.classList.add('small');    // CSS class for small icon buttons
            deleteBtn.setAttribute('aria-label', 'Delete chat');
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent li click event
                handleDeleteChat(chat.id);
            };
            actionsDiv.appendChild(deleteBtn);
            listItem.appendChild(actionsDiv);
            
            listItem.onclick = () => {
                handleLoadChat(chat.id);
                 // Optional: Add 'active' class to this item and remove from others
                document.querySelectorAll('.chat-list .chat-item.active').forEach(item => item.classList.remove('active'));
                listItem.classList.add('active');
            };
            
            chatHistoryList.appendChild(listItem);
            console.log(`Appended chat item ${index + 1}/${chats.length} to UI: "${titleSpan.textContent}" (ID: ${chat.id})`);
        });


        console.log('Finished populating chat history UI.');
    } catch (error) {
        console.error('Error loading chat history:', error);
        const errorItem = document.createElement('li');
        errorItem.textContent = 'Error loading chats.';
        errorItem.classList.add('error-message');
        chatHistoryList.appendChild(errorItem);
    }
}

function clearChatHistoryUI() {
    if (chatHistoryList) {
        chatHistoryList.innerHTML = '';
    }
}

function clearChatMessagesUI() {
    // Clear message container contents
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        messagesContainer.style.display = 'none'; // Hide messages area
    }
    
    // Reset and show welcome container
    if (welcomeContainer) {
        welcomeContainer.style.display = 'flex';
        welcomeContainer.style.opacity = '1';
        
        // Make sure the time greeting is updated
        updateTimeGreeting();
        
        // Ensure suggestion pills are active
        const suggestionPills = document.querySelectorAll('.suggestion-pill');
        if (suggestionPills) {
            suggestionPills.forEach(pill => {
                pill.style.opacity = '1';
                pill.style.pointerEvents = 'auto';
            });


        }
    }
    
    // Reset chat input styling
    const chatInputWrapper = document.querySelector('.chat-input-wrapper');
    if (chatInputWrapper) {
        chatInputWrapper.classList.remove('messages-view');
    }
    
    // Clear messages from state
    state.chat.messages = [];
}

async function handleNewChatClick() {
    state.chat.currentChatId = null;
    localStorage.removeItem('currentChatId');
    clearChatMessagesUI();
    if (chatInput) chatInput.value = '';
    
    // Highlight no chat in history
    document.querySelectorAll('#chatHistoryList li').forEach(item => {
        item.classList.remove('active');
    });


    
    // Make sure welcome container is shown with proper animations
    if (welcomeContainer) {
        // First ensure it's visible
        welcomeContainer.style.display = 'flex';
        welcomeContainer.style.opacity = '1';
        
        // Update the greeting with current time
        updateTimeGreeting();
        
        // Reset suggestion pills to be clickable
        const suggestionPills = document.querySelectorAll('.suggestion-pill');
        if (suggestionPills) {
            suggestionPills.forEach(pill => {
                pill.style.opacity = '1';
                pill.style.pointerEvents = 'auto';
            });


        }
    }
    
    // Hide messages area
    if (messagesContainer) {
        messagesContainer.style.display = 'none';
    }
    
    // Reset chat input wrapper styling
    const chatInputWrapper = document.querySelector('.chat-input-wrapper');
    if (chatInputWrapper) {
        chatInputWrapper.classList.remove('messages-view');
    }
}

async function handleLoadChat(chatId) {
    if (!chatId) return;
    console.log(`Loading chat: ${chatId}`);
    state.chat.currentChatId = chatId;
    localStorage.setItem('currentChatId', chatId);
    
    // Get the chat messages container using the correct selector
    const chatMessages = document.querySelector('.chat-messages');
    const welcomeContainer = document.querySelector('.welcome-container');
    
    if (!chatMessages) {
        console.error('Chat messages container not found for loading messages.');
        return;
    }
    
    // Clear previous messages
    chatMessages.innerHTML = '';
    
    // Hide welcome screen and show chat messages
    if (welcomeContainer) {
        welcomeContainer.style.display = 'none';
    }
    
    // Make sure the chat container is visible with the correct display style
    chatMessages.style.display = 'block';

    try {
        // Get messages from Firebase with fallback to localStorage
        const messages = await getFirebaseChatMessages(chatId);
        
        // Clear existing messages in state
        state.chat.messages = [];
        
        // Add each message to UI and state
        messages.forEach(msg => {
            addMessageToUI(msg.sender, msg.content);
            state.chat.messages.push(msg);
        });
        
        // If no messages were found, show a system message
        if (messages.length === 0) {
            console.log('No messages found for this chat.');
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        addMessageToUI('system', `Error loading messages: ${error.message || 'Please try again.'}`);
    }
    
    // Highlight active chat in sidebar
    document.querySelectorAll('#chatHistoryList li').forEach(item => {
        if (item.dataset.chatId === chatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Function to load chat messages - serves as a wrapper for handleLoadChat
async function loadChatMessages(chatId) {
    if (!chatId) return;
    console.log(`Loading messages for chat: ${chatId}`);
    await handleLoadChat(chatId);
}

function handleDeleteChat(chatId) {
    if (!chatId) return;
    
    // Store the chatId to be deleted
    state.deletingChatId = chatId;
    
    // Show the delete confirmation modal
    const deleteChatModal = document.getElementById('deleteChatModal');
    if (deleteChatModal) {
        // Show the modal and set up keyboard events
        deleteChatModal.style.display = 'flex';
        // Add keydown event listener when modal is shown
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const confirmBtn = document.getElementById('confirmDeleteChatBtn');
                if (confirmBtn) confirmBtn.click();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                state.deletingChatId = null;
                deleteChatModal.style.display = 'none';
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        
        // Add the event listener
        document.addEventListener('keydown', handleKeyDown);
        
        // Focus the cancel button for better keyboard navigation
        const cancelBtn = document.getElementById('cancelDeleteChatBtn');
        if (cancelBtn) cancelBtn.focus();
    }
}

// Function to actually delete the chat after confirmation
async function confirmDeleteChat() {
    const chatId = state.deletingChatId;
    if (!chatId) return;
    
    console.log(`Deleting chat: ${chatId}`);

    try {
        // Delete chat and its messages from Firebase with fallback to localStorage
        await deleteFirebaseChat(chatId);

        console.log('Chat deleted successfully');
        await loadChatHistory(); // Refresh the history list

        // If the deleted chat was the current one, clear the view
        if (state.chat.currentChatId === chatId) {
            handleNewChatClick(); // Or a more specific clear function
        }
        
        // Clear the deletingChatId
        state.deletingChatId = null;
        
        // Hide the modal
        const deleteChatModal = document.getElementById('deleteChatModal');
        if (deleteChatModal) {
            deleteChatModal.style.display = 'none';
        }

    } catch (error) {
        console.error('Error deleting chat:', error);
        showToast('Failed to delete chat. Please try again.'); // User-facing error using toast instead of alert
    }
}

// --- END CHAT HISTORY FUNCTIONS ---

// --- FIREBASE CHAT FUNCTIONS ---

// Helper function to get all chats from Firebase
async function getFirebaseChats() {
    // If user is not logged in, fall back to local storage
    if (!auth.currentUser) {
        console.log('No user logged in, getting chats from localStorage');
        return getLocalChats();
    }
    
    try {
        console.log(`Attempting to get chats for user: ${auth.currentUser.uid}`);
        const chatsQuery = query(
            collection(db, 'chats'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('lastUpdatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(chatsQuery);
        const chats = [];
        
        console.log(`Found ${querySnapshot.size} chats in Firebase`);
        querySnapshot.forEach((doc) => {
            chats.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return chats;
    } catch (error) {
        console.error('Error getting chats from Firebase:', error);
        console.log('Falling back to localStorage for chats');
        // Fall back to local storage on error
        return getLocalChats();
    }
}

// Helper function to save a chat to Firebase
async function saveFirebaseChat(chat) {
    // If user is not logged in, fall back to local storage
    if (!auth.currentUser) {
        const chats = getLocalChats();
        const existingIndex = chats.findIndex(c => c.id === chat.id);
        
        if (existingIndex !== -1) {
            chats[existingIndex] = chat;
        } else {
            chats.unshift(chat);
        }
        
        saveLocalChats(chats);
        return chat.id;
    }
    
    try {
        // If the chat has a local ID, create a new Firebase document
        if (chat.id.startsWith('local-chat-')) {
            // Create a new chat document with a Firebase-generated ID
            const chatRef = await addDoc(collection(db, 'chats'), {
                ...chat,
                userId: auth.currentUser.uid,
                migratedFromLocal: true,
                migratedAt: new Date().toISOString()
            });
            
            return chatRef.id;
        } else {
            // Update existing chat
            await setDoc(doc(db, 'chats', chat.id), {
                ...chat,
                userId: auth.currentUser.uid
            });
            
            return chat.id;
        }
    } catch (error) {
        console.error('Error saving chat to Firebase:', error);
        // Fall back to local storage on error
        const chats = getLocalChats();
        const existingIndex = chats.findIndex(c => c.id === chat.id);
        
        if (existingIndex !== -1) {
            chats[existingIndex] = chat;
        } else {
            chats.unshift(chat);
        }
        
        saveLocalChats(chats);
        return chat.id;
    }
}

// Helper function to get messages for a specific chat from Firebase
async function getFirebaseChatMessages(chatId) {
    // If user is not logged in or chat has a local ID, fall back to local storage
    if (!auth.currentUser || chatId.startsWith('local-chat-')) {
        return getLocalChatMessages(chatId);
    }
    
    try {
        const messagesQuery = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(messagesQuery);
        const messages = [];
        
        querySnapshot.forEach((doc) => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return messages;
    } catch (error) {
        console.error('Error getting chat messages from Firebase:', error);
        // Fall back to local storage on error
        return getLocalChatMessages(chatId);
    }
}

// Helper function to add a message to a chat in Firebase
async function addFirebaseChatMessage(chatId, message) {
    // Return a promise that resolves immediately to not block the main thread
    return new Promise((resolve) => {
        // Run in the next tick to prevent blocking
        setTimeout(async () => {
            try {
                message.timestamp = new Date().toISOString();
                
                // If user is not logged in or chat has a local ID, fall back to local storage
                if (!auth.currentUser || chatId.startsWith('local-chat-')) {
                    console.log(`Using localStorage for message in chat ${chatId}`);
                    addLocalChatMessage(chatId, message);
                    resolve();
                    return;
                }
                
                // Generate a unique ID for the message
                const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
                
                // Check if the chat exists before adding a message
                const chatDocRef = doc(db, 'chats', chatId);
                const chatDoc = await getDoc(chatDocRef);
                
                if (!chatDoc.exists()) {
                    console.warn(`Chat ${chatId} does not exist in Firebase, falling back to localStorage`);
                    addLocalChatMessage(chatId, message);
                    resolve();
                    return;
                }
                
                // Add message to Firebase using setDoc with a specific ID
                await setDoc(doc(db, 'chats', chatId, 'messages', messageId), message);
                
                // Update chat timestamp
                await updateDoc(doc(db, 'chats', chatId), {
                    lastUpdatedAt: new Date().toISOString()
                });
                
                // Update the UI state in the next tick
                requestAnimationFrame(() => {
                    if (chatId === state.chat.currentChatId) {
                        state.chat.messages = state.chat.messages || [];
                        state.chat.messages.push(message);
                    }
                    resolve();
                });
                
            } catch (error) {
                console.error('Error in background message save:', error);
                // Fall back to local storage on error
                addLocalChatMessage(chatId, message);
                resolve();
            }
        }, 0);
    });
}

// Helper function to create a new chat in Firebase
async function createFirebaseChat(title) {
    // If user is not logged in, fall back to local storage
    if (!auth.currentUser) {
        console.log('No user logged in, creating local chat');
        return createLocalChat(title, 'local-user');
    }
    
    console.log(`Attempting to create Firebase chat with title: ${title} for user: ${auth.currentUser.uid}`);
    
    try {
        // First create the chat document with the user ID
        const newChat = {
            userId: auth.currentUser.uid,
            title: title,
            createdAt: new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString()
        };
        
        console.log('Chat object prepared:', newChat);
        
        // Use setDoc with a specific ID instead of addDoc to work better with security rules
        // Generate a unique ID for the chat
        const chatId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        console.log(`Generated chat ID: ${chatId}`);
        
        // Check if the user is still authenticated
        if (!auth.currentUser) {
            console.warn('User authentication lost during chat creation, falling back to local storage');
            return createLocalChat(title, 'local-user');
        }
        
        // Try to create the chat document
        await setDoc(doc(db, 'chats', chatId), newChat);
        console.log(`Successfully created chat with ID: ${chatId} in Firebase`);
        return chatId;
    } catch (error) {
        console.error('Error creating chat in Firebase:', error);
        console.log('Error details:', error.code, error.message);
        // Show a more user-friendly message
        showToast('Could not save chat to cloud. Using local storage instead.');
        // Fall back to local storage on error
        return createLocalChat(title, auth.currentUser ? auth.currentUser.uid : 'local-user');
    }
}

// Helper function to delete a chat and its messages from Firebase
async function deleteFirebaseChat(chatId) {
    // If user is not logged in or chat has a local ID, fall back to local storage
    if (!auth.currentUser || chatId.startsWith('local-chat-')) {
        deleteLocalChat(chatId);
        return;
    }
    
    try {
        // Delete all messages in the chat
        const messagesQuery = query(collection(db, 'chats', chatId, 'messages'));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        // Use a batch to delete all messages
        const batch = writeBatch(db);
        messagesSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        // Delete the chat document
        batch.delete(doc(db, 'chats', chatId));
        
        // Commit the batch
        await batch.commit();
    } catch (error) {
        console.error('Error deleting chat from Firebase:', error);
        // Fall back to local storage on error
        deleteLocalChat(chatId);
    }
}

// --- LOCAL STORAGE CHAT FUNCTIONS ---
// These are kept for backward compatibility and as fallbacks

// Helper function to get all chats from localStorage
function getLocalChats() {
    const chatsJson = localStorage.getItem('singularity_chats');
    return chatsJson ? JSON.parse(chatsJson) : [];
}

// Helper function to save all chats to localStorage
function saveLocalChats(chats) {
    localStorage.setItem('singularity_chats', JSON.stringify(chats));
}

// Helper function to get messages for a specific chat
function getLocalChatMessages(chatId) {
    const messagesJson = localStorage.getItem(`singularity_chat_${chatId}_messages`);
    return messagesJson ? JSON.parse(messagesJson) : [];
}

// Helper function to save messages for a specific chat
function saveLocalChatMessages(chatId, messages) {
    localStorage.setItem(`singularity_chat_${chatId}_messages`, JSON.stringify(messages));
}

// Helper function to create a new chat in localStorage
function createLocalChat(title, userId = 'local-user') {
    const chatId = 'local-chat-' + Date.now();
    const newChat = {
        id: chatId,
        userId: userId,
        title: title,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
    };
    
    const chats = getLocalChats();
    chats.unshift(newChat); // Add to beginning of array
    saveLocalChats(chats);
    
    return chatId;
}

// Helper function to update a chat's lastUpdatedAt timestamp
function updateLocalChatTimestamp(chatId) {
    const chats = getLocalChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex !== -1) {
        chats[chatIndex].lastUpdatedAt = new Date().toISOString();
        saveLocalChats(chats);
    }
}

// Helper function to add a message to a chat
function addLocalChatMessage(chatId, message) {
    const messages = getLocalChatMessages(chatId);
    message.timestamp = new Date().toISOString();
    messages.push(message);
    saveLocalChatMessages(chatId, messages);

    // If the message is for the currently active chat, update the state as well
    if (chatId === state.chat.currentChatId) {
        state.chat.messages.push(message);
    }
}

// Helper function to delete a chat and its messages
function deleteLocalChat(chatId) {
    // Remove chat from chats list
    const chats = getLocalChats();
    const filteredChats = chats.filter(chat => chat.id !== chatId);
    saveLocalChats(filteredChats);
    
    // Remove chat messages
    localStorage.removeItem(`singularity_chat_${chatId}_messages`);
}

async function getUserSpecificOrDefaultTemplate(gemType) {
    const user = auth.currentUser;
    gemType = gemType.toLowerCase(); // Ensure consistency

    if (user) {
        try {
            const gemsRef = collection(db, 'gems');
            const q = query(gemsRef, 
                            where('userId', '==', user.uid), 
                            where('type', '==', gemType), 
                            orderBy('createdAt', 'desc'), // Get the most recent if multiple exist
                            limit(1));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userGem = querySnapshot.docs[0].data();
                console.log(`Found user-specific template for ${gemType}:`, userGem.name);
                return { name: userGem.name, prompt: userGem.prompt };
            } else {
                console.log(`No user-specific template for ${gemType}, falling back to default.`);
            }
        } catch (error) {
            console.error(`Error fetching user-specific template for ${gemType}:`, error);
            // Fall through to default if Firestore query fails
        }
    }

    // Fallback to hardcoded default if no user, or no user-specific gem found, or error
    if (defaultGemTemplates[gemType]) {
        console.log(`Using hardcoded default template for ${gemType}.`);
        return defaultGemTemplates[gemType];
    } else {
        // Ultimate fallback if no template at all
        console.warn(`No default template found for ${gemType}. Using generic fallback.`);
        const capitalizedType = gemType.charAt(0).toUpperCase() + gemType.slice(1);
        return {
            name: `My ${capitalizedType} Gem`,
            prompt: `This is a custom ${capitalizedType} gem. Define its purpose here.`
        };
    }
}

// --- GEM FUNCTIONS (Save logic is now integrated into the saveGemBtn event listener) ---
// --- END GEM FUNCTIONS ---


// --- GEM DISPLAY AND MODAL FUNCTIONS ---
async function loadUserGemsForInput() {
    if (!auth.currentUser || !inputGemsContainer) {
        if (inputGemsContainer) inputGemsContainer.innerHTML = ''; // Clear if no user
        if (inputGemsContainer) inputGemsContainer.style.display = 'none'; // Hide if no user
        console.log('No user logged in or inputGemsContainer not found, clearing/hiding gems input area.');
        return;
    }

    console.log('Loading user gems for input area...');
    inputGemsContainer.innerHTML = ''; // Clear existing static/dynamic gems
    state.selectedSystemPrompt = null; // Reset selected system prompt
    if (document.querySelector('.input-gems .gem-pill.active')) {
        document.querySelector('.input-gems .gem-pill.active').classList.remove('active');
    }

    try {
        const gemsQuery = query(collection(db, 'gems'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(gemsQuery);

        if (querySnapshot.empty) {
            console.log('No gems found for this user.');
            inputGemsContainer.style.display = 'none'; // Hide container if no gems
            return;
        }

        inputGemsContainer.style.display = 'flex'; // Show container if gems exist
        querySnapshot.forEach((doc) => {
            const gem = doc.data();
            const gemPill = document.createElement('div');
            gemPill.classList.add('gem-pill', gem.type.toLowerCase());
            gemPill.dataset.gemId = doc.id;
            gemPill.dataset.gemPrompt = gem.prompt; // Store the prompt
            gemPill.title = `System Prompt: ${gem.prompt.substring(0, 100)}${gem.prompt.length > 100 ? '...' : ''}`;

            const img = document.createElement('img');
            img.src = `images/gem-${gem.type.toLowerCase()}.svg`;
            img.alt = `${gem.name} Gem`;
            img.classList.add('gem-mini');

            const span = document.createElement('span');
            // Format the gem name consistently with type name
            const capitalizedType = gem.type.charAt(0).toUpperCase() + gem.type.slice(1);
            
            const gemNameSpan = document.createElement('span');
            gemNameSpan.textContent = `${capitalizedType}: ${gem.name}`;
            gemNameSpan.classList.add('gem-item-name');
            
            // Type is now included in the name, so we can remove the separate type span
            // const gemTypeSpan = document.createElement('span');
            // gemTypeSpan.textContent = `(${gem.type})`;
            // gemTypeSpan.classList.add('gem-item-type');

            gemPill.appendChild(img);
            gemPill.appendChild(gemNameSpan);
            // gemPill.appendChild(gemTypeSpan); // No longer needed since type is in the name

            gemPill.addEventListener('click', () => {
                // Check if this gem is already active
                const isCurrentlyActive = gemPill.classList.contains('active');
                
                // Remove active class from any currently active pill
                const currentActive = inputGemsContainer.querySelector('.gem-pill.active');
                if (currentActive) {
                    currentActive.classList.remove('active');
                    // Reset the system prompt
                    state.selectedSystemPrompt = null;
                }
                
                // Only select the gem if it wasn't already active
                if (!isCurrentlyActive) {
                    // Add active class to the clicked pill
                    gemPill.classList.add('active');
                    state.selectedSystemPrompt = gem.prompt; // Store the selected gem's prompt
                    console.log(`Selected Gem: ${gem.name}, Prompt: ${state.selectedSystemPrompt.substring(0,50)}...`);
                } else {
                    console.log(`Unselected Gem: ${gem.name}`);
                }
            });



            inputGemsContainer.appendChild(gemPill);
        });


        console.log(`${querySnapshot.size} gems loaded into input area.`);
    } catch (error) {
        console.error('Error loading user gems for input:', error);
        showToast('Could not load your gems.');
        inputGemsContainer.style.display = 'none'; // Hide on error
    }
}

async function loadUserGemsForModal() {
    if (!auth.currentUser || !existingGemsList || !noGemsMessage) {
        console.log('User not logged in or modal gem list elements not found.');
        if (existingGemsList) existingGemsList.innerHTML = '';
        if (noGemsMessage) noGemsMessage.style.display = 'block';
        return;
    }

    console.log('Loading user gems for modal list...');
    existingGemsList.innerHTML = ''; // Clear existing items

    try {
        const gemsQuery = query(collection(db, 'gems'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(gemsQuery);

        if (querySnapshot.empty) {
            console.log('No gems found for this user to display in modal.');
            noGemsMessage.style.display = 'block';
            existingGemsList.style.display = 'none';
            return;
        }

        noGemsMessage.style.display = 'none';
        existingGemsList.style.display = 'block';

        querySnapshot.forEach((doc) => {
            const gem = doc.data();
            const listItem = document.createElement('li');
            listItem.classList.add('existing-gem-item');
            listItem.dataset.gemId = doc.id;

            // Format gem name consistently with capitalized type
            const capitalizedType = gem.type.charAt(0).toUpperCase() + gem.type.slice(1);
            
            const gemNameSpan = document.createElement('span');
            gemNameSpan.textContent = `${capitalizedType}: ${gem.name}`;
            gemNameSpan.classList.add('gem-item-name');
            
            // Type is now included in the name, so we can remove the separate type span
            // const gemTypeSpan = document.createElement('span');
            // gemTypeSpan.textContent = `(${gem.type})`;
            // gemTypeSpan.classList.add('gem-item-type');

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.classList.add('btn-edit-gem');
            editButton.addEventListener('click', () => populateGemModalForEditing(doc.id, gem));

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('btn-delete-gem');
            deleteButton.addEventListener('click', () => handleDeleteGem(doc.id, gem.name));

            listItem.appendChild(gemNameSpan);
            // listItem.appendChild(gemTypeSpan); // No longer needed since type is in the name
            listItem.appendChild(editButton);
            listItem.appendChild(deleteButton);
            existingGemsList.appendChild(listItem);
        });


        console.log(`${querySnapshot.size} gems loaded into modal list.`);
    } catch (error) {
        console.error('Error loading user gems for modal:', error);
        showToast('Could not load your gems for the modal.');
        noGemsMessage.style.display = 'block';
        existingGemsList.style.display = 'none';
    }
}

function populateGemModalForEditing(gemId, gemData) {
    console.log(`Populating modal for editing gem: ${gemData.name} (ID: ${gemId})`);
    gemNameInput.value = gemData.name;
    systemPromptInput.value = gemData.prompt;
    state.editingGemId = gemId; // Store the ID of the gem being edited

    gemOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.querySelector('span').textContent.toLowerCase() === gemData.type.toLowerCase()) {
            option.classList.add('selected');
        }
    });


    document.getElementById('saveGemBtn').textContent = 'Update Gem'; // Change button text
    // Optionally, scroll to the top of the modal or focus the first field
    gemNameInput.focus(); 
}

async function handleDeleteGem(gemId, gemName) {
    if (!confirm(`Are you sure you want to delete the gem "${gemName}"? This action cannot be undone.`)) {
        return;
    }
    console.log(`Attempting to delete gem: ${gemName} (ID: ${gemId})`);
    try {
        await deleteDoc(doc(db, 'gems', gemId));
        showToast(`Gem "${gemName}" deleted successfully.`);
        console.log(`Gem "${gemName}" (ID: ${gemId}) deleted from Firestore.`);
        loadUserGemsForModal(); // Refresh the list in the modal
        loadUserGemsForInput(); // Also refresh the gems in the input area
        // If the deleted gem was being edited, reset the form
        if (state.editingGemId === gemId) {
            gemNameInput.value = '';
            systemPromptInput.value = '';
            state.editingGemId = null;
            gemOptions.forEach(opt => opt.classList.remove('selected'));
            if (gemOptions.length > 0) gemOptions[0].classList.add('selected');
            document.getElementById('saveGemBtn').textContent = 'Save Gem';
        }
    } catch (error) {
        console.error('Error deleting gem:', error);
        showToast(`Error deleting gem "${gemName}".`);
    }
}

// Function to populate Personas in the user dropdown menu
async function populateUserMenuGems() {
    if (!auth.currentUser || !userMenuGemsList) {
        if (userMenuGemsList) userMenuGemsList.innerHTML = '<p class="no-gems-in-menu">Login to see your Personas.</p>';
        return;
    }

    userMenuGemsList.innerHTML = ''; // Clear existing items

    try {
        const gemsQuery = query(collection(db, 'gems'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(gemsQuery);

        if (querySnapshot.empty) {
            userMenuGemsList.innerHTML = '<p class="no-gems-in-menu">No Personas yet. Click + to add!</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const gem = doc.data();
            const gemItemDiv = document.createElement('div');
            gemItemDiv.classList.add('user-menu-gem-item');
            gemItemDiv.dataset.gemId = doc.id; // Store the gem ID for delete functionality

            const gemIconImg = document.createElement('img');
            gemIconImg.src = `images/gem-${gem.type.toLowerCase()}.svg`;
            gemIconImg.alt = `${gem.type} Persona`;
            gemIconImg.classList.add('user-menu-gem-icon');

            const gemNameSpan = document.createElement('span');
            gemNameSpan.textContent = gem.name;
            gemNameSpan.classList.add('user-menu-gem-name');
            
            // Create delete button
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('gem-delete-btn');
            deleteButton.innerHTML = '<span class="material-symbols-rounded">delete</span>';
            deleteButton.title = 'Delete this persona';
            
            // Add event listener for delete button
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the click from bubbling to the parent
                handleDeleteGem(doc.id, gem.name);
            });

            gemItemDiv.appendChild(gemIconImg);
            gemItemDiv.appendChild(gemNameSpan);
            gemItemDiv.appendChild(deleteButton);
            userMenuGemsList.appendChild(gemItemDiv);
            
            // Add click event to open the gem modal for editing when clicking on the gem item
            gemItemDiv.addEventListener('click', () => {
                gemModal.style.display = 'block';
                populateGemModalForEditing(doc.id, gem);
            });
        });
    } catch (error) {
        console.error('Error loading Personas for user menu:', error);
        userMenuGemsList.innerHTML = '<p class="no-gems-in-menu">Error loading Personas.</p>';
    }
}

// --- END GEM DISPLAY AND MODAL FUNCTIONS ---

// --- USER PROFILE FUNCTIONS ---
async function loadUserProfile(userId) {
    if (!userId) return;
    
    showLoadingScreen(); // Show loading screen during profile loading
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const currentUser = auth.currentUser;
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            
            // Prioritize email from Firebase Auth for display consistency
            if (currentUser && currentUser.uid === userId) {
                state.user.email = currentUser.email;
            } else {
                state.user.email = userData.email; // Fallback to Firestore email if auth mismatch (should be rare)
                console.warn("Auth user mismatch or unavailable when setting email in loadUserProfile. Using Firestore email for user:", userId);
            }
            
            // Derive name with robust fallbacks
            const firestoreName = userData.name;
            const authDisplayName = currentUser ? currentUser.displayName : null;
            let derivedFromEmail = 'User'; // Default fallback
            if (state.user.email) {
                const emailLocalPart = state.user.email.split('@')[0];
                derivedFromEmail = emailLocalPart || state.user.email; // Use full email if local part is empty
            }
            let determinedName = firestoreName || authDisplayName || derivedFromEmail;
            state.user.name = determinedName || 'User'; // Ensure name is never falsy, defaults to 'User'
            state.user.apiKey = userData.apiKey || '';
            state.settings.model = userData.defaultModel || state.settings.model;

            // Update UI
            if (userMenuName) userMenuName.textContent = state.user.name;
            if (userMenuEmail) userMenuEmail.textContent = state.user.email;
            
            // Ensure API key is set in the input field and saved to localStorage
            if (userData.apiKey) {
                state.user.apiKey = userData.apiKey;
                localStorage.setItem('geminiApiKey', userData.apiKey);
                console.log('API key loaded from Firestore:', !!userData.apiKey);
            }
            
            // Force update the API key input field
            setTimeout(() => {
                if (apiKeyInput) {
                    apiKeyInput.value = state.user.apiKey || '';
                    console.log('API key set in input field (delayed):', !!apiKeyInput.value);
                }
            }, 100); // Small delay to ensure DOM is ready
            
            if (modelSelector && state.settings.model) modelSelector.value = state.settings.model;
            if (defaultModel && state.settings.model) defaultModel.value = state.settings.model;
            
            // Set default avatar
            const placeholderUrl = 'images/avatar-placeholder.png';
            if (headerAvatarDisplay) headerAvatarDisplay.src = placeholderUrl;
            if (userMenuProfilePicDisplay) userMenuProfilePicDisplay.src = placeholderUrl;

            // Fetch models if API key is present
            if (state.user.apiKey) {
                await fetchGeminiModels();
            } else {
                useDefaultModels(); // Use default models if no API key
            }

        } else {
            console.log(`No user document found in Firestore for UID: ${userId}. Using details from Firebase Auth.`);
            if (currentUser && currentUser.uid === userId) {
                state.user.email = currentUser.email;
                // Derive name with robust fallbacks when Firestore doc is missing
                const authDisplayNameWhenNoDoc = currentUser.displayName;
                let derivedFromEmailWhenNoDoc = 'User'; // Default fallback
                if (currentUser.email) {
                    const emailLocalPartWhenNoDoc = currentUser.email.split('@')[0];
                    derivedFromEmailWhenNoDoc = emailLocalPartWhenNoDoc || currentUser.email; // Use full email if local part is empty
                }
                let determinedNameNoDoc = authDisplayNameWhenNoDoc || derivedFromEmailWhenNoDoc;
                state.user.name = determinedNameNoDoc || 'User'; // Ensure name is never falsy, defaults to 'User'
                state.user.apiKey = ''; // No API key from Firestore
                state.settings.model = localStorage.getItem('defaultModel') || 'gemini-2.5-pro-preview-05-06'; // Default model

                if (userMenuName) userMenuName.textContent = state.user.name;
                if (userMenuEmail) userMenuEmail.textContent = state.user.email;
                
                // Set default avatar
                const placeholderUrl = 'images/avatar-placeholder.png';
                if (headerAvatarDisplay) headerAvatarDisplay.src = placeholderUrl;
                if (userMenuProfilePicDisplay) userMenuProfilePicDisplay.src = placeholderUrl;
                
                if (apiKeyInput) apiKeyInput.value = state.user.apiKey;
                if (modelSelector) modelSelector.value = state.settings.model;
                if (defaultModel) defaultModel.value = state.settings.model;

                console.warn(`Firestore document for user ${userId} is missing. Consider creating it with basic info upon first login if necessary.`);
            } else {
                console.error('Critical: Mismatch or no currentUser in loadUserProfile (user document missing). Cannot display user info for UID:', userId);
                if (userMenuName) userMenuName.textContent = 'Error';
                if (userMenuEmail) userMenuEmail.textContent = 'Error';
                const placeholderUrl = 'images/avatar-placeholder.png';
                if (headerAvatarDisplay) headerAvatarDisplay.src = placeholderUrl;
                if (userMenuProfilePicDisplay) userMenuProfilePicDisplay.src = placeholderUrl;
            }
            useDefaultModels(); // Ensure model selectors are populated
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        showToast('Error loading profile.', 'error');
        
        const currentUser = auth.currentUser;
        let nameToDisplay = 'User';
        let emailToDisplay = 'N/A';

        if (currentUser && currentUser.email) {
            emailToDisplay = currentUser.email;
            const emailLocalPart = currentUser.email.split('@')[0];
            nameToDisplay = currentUser.displayName || emailLocalPart || currentUser.email; // Use display name, or local part, or full email
        }
        nameToDisplay = nameToDisplay || 'User'; // Final fallback for name

        if (userMenuName) userMenuName.textContent = nameToDisplay;
        if (userMenuEmail) userMenuEmail.textContent = emailToDisplay;
        
        const placeholderUrl = 'images/avatar-placeholder.png';
        if (headerAvatarDisplay) headerAvatarDisplay.src = placeholderUrl;
        if (userMenuProfilePicDisplay) userMenuProfilePicDisplay.src = placeholderUrl;
        useDefaultModels(); // Ensure model selectors are populated even in error state
    } finally {
        hideLoadingScreen(); // Hide loading screen when profile loading is complete
    }
}

// Profile picture functions removed as requested

// --- END USER PROFILE FUNCTIONS ---

// --- FILE HANDLING FUNCTIONS ---
// Process an image file (from upload or paste) and prepare it for sending to the API
async function processImageFile(file) {
    try {
        // Read the file as a data URL (base64)
        const base64Data = await readFileAsDataURL(file);
        
        // Extract the base64 content without the data URL prefix
        const base64Content = base64Data.split(',')[1];
        
        // Store the file data and type in the state
        state.chat.fileData = base64Content;
        state.chat.fileType = file.type;
        state.chat.fileFormat = 'image';
        
        // Show a preview of the image in the chat input area
        showImagePreview(base64Data);
        
        // Show a toast notification
        showToast('Image ready to send');
    } catch (error) {
        console.error('Error processing image:', error);
        showToast('Failed to process image');
    }
}

// Process a PDF file and prepare it for sending to the API
async function processPdfFile(file) {
    try {
        // Check file size (limit to 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showToast('PDF file is too large. Maximum size is 10MB.');
            return;
        }
        
        // Read the file as a data URL (base64)
        const base64Data = await readFileAsDataURL(file);
        
        // Extract the base64 content without the data URL prefix
        const base64Content = base64Data.split(',')[1];
        
        // Store the file data and type in the state
        state.chat.fileData = base64Content;
        state.chat.fileType = file.type;
        state.chat.fileFormat = 'pdf';
        
        // Show a preview of the PDF in the chat input area
        showPdfPreview(file);
        
        // Show a toast notification
        showToast('PDF ready to send');
    } catch (error) {
        console.error('Error processing PDF:', error);
        showToast('Failed to process PDF');
    }
}

// Read a file as a data URL (base64)
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Show a preview of the image in the chat input area
function showImagePreview(dataUrl) {
    // Check if a preview already exists and remove it
    const existingPreview = document.querySelector('.file-preview-container');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create a preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container image-preview-container';
    
    // Create the image element
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'image-preview';
    
    // Create a remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file-btn';
    removeBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';
    removeBtn.title = 'Remove image';
    
    // Add event listener to remove button
    removeBtn.addEventListener('click', () => {
        previewContainer.remove();
        state.chat.fileData = null;
        state.chat.fileType = null;
        state.chat.fileFormat = null;
    });
    
    // Append elements to the container
    previewContainer.appendChild(img);
    previewContainer.appendChild(removeBtn);
    
    // Add the preview to the chat input area (before the textarea)
    const chatInputContainer = document.querySelector('.chat-input');
    chatInputContainer.insertBefore(previewContainer, chatInputContainer.firstChild);
}

// Show a simple PDF preview with filename in the chat input area
function showPdfPreview(file) {
    // Check if a preview already exists and remove it
    const existingPreview = document.querySelector('.file-preview-container');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create a preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'file-preview-container pdf-preview-container';
    
    // Create the PDF info element
    const pdfInfo = document.createElement('div');
    pdfInfo.className = 'pdf-info';
    pdfInfo.innerHTML = `
        <span class="material-symbols-rounded">picture_as_pdf</span>
        <span class="pdf-name">${file.name}</span>
        <span class="pdf-size">(${formatFileSize(file.size)})</span>
    `;
    
    // Create a remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-file-btn';
    removeBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';
    removeBtn.title = 'Remove PDF';
    
    // Add event listener to remove button
    removeBtn.addEventListener('click', () => {
        previewContainer.remove();
        state.chat.fileData = null;
        state.chat.fileType = null;
        state.chat.fileFormat = null;
    });
    
    // Append elements to the container
    previewContainer.appendChild(pdfInfo);
    previewContainer.appendChild(removeBtn);
    
    // Add the preview to the chat input area (before the textarea)
    const chatInputContainer = document.querySelector('.chat-input');
    chatInputContainer.insertBefore(previewContainer, chatInputContainer.firstChild);
}

// Format file size in bytes to human-readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- ACTION BUTTONS FUNCTIONALITY ---
function setupActionButtons() {
    const actionButtons = document.querySelectorAll('.action-buttons .btn-icon');
    
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Toggle active state for the clicked button
            this.classList.toggle('active');
            
            // Get the action type
            const action = this.getAttribute('data-action');
            const isActive = this.classList.contains('active');
            
            if (action) {
                console.log(`Action ${isActive ? 'activated' : 'deactivated'}: ${action}`);
                
                // Add specific actions based on button type
                switch(action) {
                    case 'attachment':
                        // Handle attachment action
                        if (isActive) {
                            // Action when activated
                        } else {
                            // Action when deactivated
                        }
                        break;
                    case 'think-longer':
                        // Handle think longer action
                        break;
                    case 'web-search':
                        // Handle web search action
                        if (isActive) {
                            // If image generation or document generation is enabled, disable it first
                            if (state.enabledTools.imageGeneration) {
                                // Find and deactivate the image generation button
                                const imageGenButton = document.querySelector('.action-buttons .btn-icon[data-action="generate-image"]');
                                if (imageGenButton && imageGenButton.classList.contains('active')) {
                                    imageGenButton.classList.remove('active');
                                }
                                state.enabledTools.imageGeneration = false;
                                showToast('Image generation disabled');
                            }
                            
                            if (state.enabledTools.documentGeneration) {
                                // Find and deactivate the document generation button
                                const documentGenButton = document.querySelector('.action-buttons .btn-icon[data-action="generate-document"]');
                                if (documentGenButton && documentGenButton.classList.contains('active')) {
                                    documentGenButton.classList.remove('active');
                                }
                                state.enabledTools.documentGeneration = false;
                                showToast('Document generation disabled');
                            }
                            
                            // Enable web search
                            state.enabledTools.webSearch = true;
                            showToast('Web search enabled');
                        } else {
                            // Disable web search
                            state.enabledTools.webSearch = false;
                            showToast('Web search disabled');
                        }
                        console.log('Web search ' + (isActive ? 'enabled' : 'disabled'));
                        break;
                    case 'surf-websites':
                        // Handle surf websites action
                        if (isActive) {
                            // If image generation or document generation is enabled, disable it first
                            if (state.enabledTools.imageGeneration) {
                                // Find and deactivate the image generation button
                                const imageGenButton = document.querySelector('.action-buttons .btn-icon[data-action="generate-image"]');
                                if (imageGenButton && imageGenButton.classList.contains('active')) {
                                    imageGenButton.classList.remove('active');
                                }
                                state.enabledTools.imageGeneration = false;
                                showToast('Image generation disabled');
                            }
                            
                            if (state.enabledTools.documentGeneration) {
                                // Find and deactivate the document generation button
                                const documentGenButton = document.querySelector('.action-buttons .btn-icon[data-action="generate-document"]');
                                if (documentGenButton && documentGenButton.classList.contains('active')) {
                                    documentGenButton.classList.remove('active');
                                }
                                state.enabledTools.documentGeneration = false;
                                showToast('Document generation disabled');
                            }
                            
                            // Enable website browsing
                            state.enabledTools.websiteBrowsing = true;
                            showToast('Website surfing enabled');
                        } else {
                            // Disable website browsing
                            state.enabledTools.websiteBrowsing = false;
                            showToast('Website surfing disabled');
                        }
                        console.log('Website surfing ' + (isActive ? 'enabled' : 'disabled'));
                        break;
                    case 'create-image':
                        // Handle create image action
                        break;
                    case 'generate-image':
                        // Handle image generation action
                        if (isActive) {
                            // If any other tool is enabled, disable it first
                            if (state.enabledTools.webSearch || state.enabledTools.websiteBrowsing || state.enabledTools.documentGeneration) {
                                // Find and deactivate other tool buttons
                                const webSearchButton = document.querySelector('.action-buttons .btn-icon[data-action="web-search"]');
                                if (webSearchButton && webSearchButton.classList.contains('active')) {
                                    webSearchButton.classList.remove('active');
                                }
                                
                                const websiteBrowsingButton = document.querySelector('.action-buttons .btn-icon[data-action="surf-websites"]');
                                if (websiteBrowsingButton && websiteBrowsingButton.classList.contains('active')) {
                                    websiteBrowsingButton.classList.remove('active');
                                }
                                
                                const documentGenButton = document.querySelector('.action-buttons .btn-icon[data-action="generate-document"]');
                                if (documentGenButton && documentGenButton.classList.contains('active')) {
                                    documentGenButton.classList.remove('active');
                                }
                                
                                // Disable other tools in state
                                state.enabledTools.webSearch = false;
                                state.enabledTools.websiteBrowsing = false;
                                state.enabledTools.documentGeneration = false;
                                showToast('Other tools disabled');
                            }
                            
                            // Enable image generation
                            state.enabledTools.imageGeneration = true;
                            showToast('Image generation enabled');
                        } else {
                            // Disable image generation
                            state.enabledTools.imageGeneration = false;
                            showToast('Image generation disabled');
                        }
                        console.log('Image generation ' + (isActive ? 'enabled' : 'disabled'));
                        break;
                        
                    case 'generate-document':
                        // Handle document generation action
                        if (isActive) {
                            // If any other tool is enabled, disable it first
                            if (state.enabledTools.webSearch || state.enabledTools.websiteBrowsing || state.enabledTools.imageGeneration) {
                                // Find and deactivate other tool buttons
                                const webSearchButton = document.querySelector('.action-buttons .btn-icon[data-action="web-search"]');
                                if (webSearchButton && webSearchButton.classList.contains('active')) {
                                    webSearchButton.classList.remove('active');
                                }
                                
                                const websiteBrowsingButton = document.querySelector('.action-buttons .btn-icon[data-action="surf-websites"]');
                                if (websiteBrowsingButton && websiteBrowsingButton.classList.contains('active')) {
                                    websiteBrowsingButton.classList.remove('active');
                                }
                                
                                const imageGenButton = document.querySelector('.action-buttons .btn-icon[data-action="generate-image"]');
                                if (imageGenButton && imageGenButton.classList.contains('active')) {
                                    imageGenButton.classList.remove('active');
                                }
                                
                                // Disable other tools in state
                                state.enabledTools.webSearch = false;
                                state.enabledTools.websiteBrowsing = false;
                                state.enabledTools.imageGeneration = false;
                                showToast('Other tools disabled');
                            }
                            
                            // Enable document generation
                            state.enabledTools.documentGeneration = true;
                            showToast('Document generation enabled');
                        } else {
                            // Disable document generation
                            state.enabledTools.documentGeneration = false;
                            showToast('Document generation disabled');
                        }
                        console.log('Document generation ' + (isActive ? 'enabled' : 'disabled'));
                        break;
                    case 'document':
                        // Toggle document generation mode
                        isActive = !button.classList.contains('active');
                        
                        // Deactivate other action buttons when document is activated
                        if (isActive) {
                            // Deactivate other buttons
                            document.querySelectorAll('.action-buttons .btn-icon').forEach(btn => {
                                if (btn !== button && btn.classList.contains('active')) {
                                    btn.classList.remove('active');
                                }
                            });
                            button.classList.add('active');
                        } else {
                            button.classList.remove('active');
                        }
                        console.log('Document generation ' + (isActive ? 'enabled' : 'disabled'));
                        break;
                }
            }
            
            // Update any UI or state based on active buttons
            updateActiveActions();
        });


    });


    
    // Function to get all currently active actions
    function getActiveActions() {
        const activeButtons = document.querySelectorAll('.action-buttons .btn-icon.active');
        return Array.from(activeButtons).map(btn => ({
            action: btn.getAttribute('data-action'),
            title: btn.getAttribute('title')
        }));
    }
    
    // Function to update UI based on active actions
    function updateActiveActions() {
        const activeActions = getActiveActions();
        console.log('Active actions:', activeActions);
        // Add any additional UI updates here
    }
}

// Setup event listeners for the delete chat confirmation modal
function setupDeleteChatModal() {
    const deleteChatModal = document.getElementById('deleteChatModal');
    const closeDeleteChatModal = document.getElementById('closeDeleteChatModal');
    const cancelDeleteChatBtn = document.getElementById('cancelDeleteChatBtn');
    const confirmDeleteChatBtn = document.getElementById('confirmDeleteChatBtn');

    // Function to close the modal
    const closeModal = () => {
        state.deletingChatId = null; // Clear the chatId
        deleteChatModal.style.display = 'none';
        // Remove the keydown event listener when modal is closed
        document.removeEventListener('keydown', handleKeyDown);
    };

    // Handle keyboard events
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (confirmDeleteChatBtn) {
                confirmDeleteChatBtn.click();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    };

    // Show modal function
    const showModal = () => {
        deleteChatModal.style.display = 'flex';
        // Add keydown event listener when modal is shown
        document.addEventListener('keydown', handleKeyDown);
        // Focus the cancel button for better keyboard navigation
        if (cancelDeleteChatBtn) {
            cancelDeleteChatBtn.focus();
        }
    };

    // Close modal when clicking the X button
    if (closeDeleteChatModal) {
        closeDeleteChatModal.addEventListener('click', closeModal);
    }

    // Close modal when clicking the Cancel button
    if (cancelDeleteChatBtn) {
        cancelDeleteChatBtn.addEventListener('click', closeModal);
    }

    // Delete chat when clicking the Delete button
    if (confirmDeleteChatBtn) {
        confirmDeleteChatBtn.addEventListener('click', () => {
            confirmDeleteChat();
            closeModal();
        });
    }

    // Close modal when clicking outside of it
    if (deleteChatModal) {
        deleteChatModal.addEventListener('click', (e) => {
            if (e.target === deleteChatModal) {
                closeModal();
            }
        });
    }
    
    // Make the modal accessible by adding role and aria attributes
    if (deleteChatModal) {
        deleteChatModal.setAttribute('role', 'dialog');
        deleteChatModal.setAttribute('aria-labelledby', 'deleteChatModalLabel');
        deleteChatModal.setAttribute('aria-modal', 'true');
    }
}

// Global loading screen management
let firebaseRequestsInProgress = 0;

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const appContainer = document.getElementById('appContainer');
    if (loadingScreen) loadingScreen.style.display = 'flex';
    if (appContainer) appContainer.classList.add('blur-content');
    firebaseRequestsInProgress++;
    console.log('Firebase request started. Active requests:', firebaseRequestsInProgress);
}

function hideLoadingScreen() {
    firebaseRequestsInProgress--;
    console.log('Firebase request completed. Remaining requests:', firebaseRequestsInProgress);
    
    if (firebaseRequestsInProgress <= 0) {
        firebaseRequestsInProgress = 0; // Ensure it doesn't go negative
        const loadingScreen = document.getElementById('loadingScreen');
        const appContainer = document.getElementById('appContainer');
        
        // Small delay to ensure smooth transition
        setTimeout(() => {
            if (loadingScreen) loadingScreen.style.display = 'none';
            if (appContainer) appContainer.classList.remove('blur-content');
        }, 500);
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Show loading screen initially
    showLoadingScreen();
    
    // Global click handler for copy options menu
    document.addEventListener('click', (event) => {
        // Check if the click was outside any copy options menu
        if (!event.target.closest('.copy-btn') && !event.target.closest('.copy-options')) {
            // Hide all copy options menus
            document.querySelectorAll('.copy-options').forEach(menu => {
                menu.style.opacity = '0';
                menu.style.transform = 'translateY(0)';
                setTimeout(() => {
                    menu.style.display = 'none';
                }, 200);
            });
        }
    });
    
    // Initialize app
    initApp().then(() => {
        // Initial app load complete, but keep loading screen until all Firebase requests finish
        hideLoadingScreen();
    }).catch(error => {
        console.error('Error initializing app:', error);
        hideLoadingScreen(); // Ensure loading screen is hidden even on error
    });
    
    setupActionButtons();
    setupDeleteChatModal();
    
    // Add event listener for New Chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', handleNewChatClick);
    }
});

// Event listener for the new 'Manage Gems' button in the user menu
if (openGemModalFromUserMenuBtn) {
    openGemModalFromUserMenuBtn.addEventListener('click', async () => {
        if (gemModal) {
            gemModal.style.display = 'flex';
            await loadUserGemsForModal(); // Load gems into the modal's list

            // Reset form for potentially adding a new gem or just viewing
            state.editingGemId = null;
            if (gemNameInput) gemNameInput.value = '';
            if (systemPromptInput) systemPromptInput.value = '';
            if (document.getElementById('saveGemBtn')) {
                document.getElementById('saveGemBtn').textContent = 'Save Gem';
            }

            // Reset and pre-fill gem type selection (e.g., to Ruby)
            let defaultGemType = 'ruby'; // Default to Ruby
            if (gemOptions && gemOptions.length > 0) {
                gemOptions.forEach(option => option.classList.remove('selected'));
                const defaultOption = Array.from(gemOptions).find(opt => opt.querySelector('span').textContent.toLowerCase() === defaultGemType);
                if (defaultOption) {
                    defaultOption.classList.add('selected');
                } else {
                    gemOptions[0].classList.add('selected'); // Fallback to the first option
                    defaultGemType = gemOptions[0].querySelector('span').textContent.toLowerCase();
                }
            }
            // Pre-fill with template for the selected default type
            const template = await getUserSpecificOrDefaultTemplate(defaultGemType);
            if (template) {
                if (gemNameInput) gemNameInput.value = template.name;
                if (systemPromptInput) systemPromptInput.value = template.prompt;
            }
            if (gemNameInput) gemNameInput.focus();
            if (userMenu) userMenu.style.display = 'none'; // Close user menu
        }
    });
}
