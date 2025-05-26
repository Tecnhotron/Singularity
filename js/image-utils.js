// Image Utilities for Singularity
import { escapeHTML } from './document-utils.js';

// Create a loading placeholder for image generation
export function createImageLoadingPlaceholder(prompt) {
    return `<div class="generated-image-container">
        <p>Generating your image${prompt ? ` of "${escapeHTML(prompt)}"` : ''}...</p>
        <div class="image-loading">
            <div class="image-loading-spinner"></div>
        </div>
        <p class="image-prompt">This may take a few seconds</p>
    </div>`;
}

// Create HTML for a generated image (without download button, which will be added by addMessageToUI)
export function createImageResultHTML(imageUrl, text, prompt) {
    const uniqueId = 'img-' + Date.now();
    const safePrompt = prompt ? escapeHTML(prompt) : 'Generated image';
    const safeText = text ? escapeHTML(text) : 'Here\'s the image I generated based on your prompt:';

    return `<div class="generated-image-container">
        <p>${safeText}</p>
        <img src="${imageUrl}" alt="Generated image for: ${safePrompt}" class="generated-image" id="${uniqueId}">
        <p class="image-prompt">Prompt: "${safePrompt}"</p>
    </div>`;
}
