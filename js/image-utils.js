// Image Utilities for Singularity

// Create a loading placeholder for image generation
export function createImageLoadingPlaceholder(prompt) {
    return `<div class="generated-image-container">
        <p>Generating your image${prompt ? ` of "${prompt}"` : ''}...</p>
        <div class="image-loading">
            <div class="image-loading-spinner"></div>
        </div>
        <p class="image-prompt">This may take a few seconds</p>
    </div>`;
}

// Create HTML for a generated image (without download button, which will be added by addMessageToUI)
export function createImageResultHTML(imageUrl, text, prompt) {
    const uniqueId = 'img-' + Date.now();
    return `<div class="generated-image-container">
        <p>${text || 'Here\'s the image I generated based on your prompt:'}</p>
        <img src="${imageUrl}" alt="Generated image for: ${prompt}" class="generated-image" id="${uniqueId}">
        <p class="image-prompt">Prompt: "${prompt}"</p>
    </div>`;
}

// Function to handle image download (to be called from onclick)
window.downloadGeneratedImage = function(imageId, prompt) {
    const image = document.getElementById(imageId);
    if (!image) return;
    
    const link = document.createElement('a');
    link.href = image.src;
    link.download = 'generated-image-' + prompt.replace(/[^a-z0-9]/gi, '-').substring(0, 30) + '.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
