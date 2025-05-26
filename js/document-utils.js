// Document Utilities for Singularity

// Create a loading placeholder for document generation
export function createDocumentLoadingPlaceholder(title) {
    return `<div class="generated-document-container">
        <p>Generating your document${title ? ` titled "${escapeHTML(title)}"` : ''}...</p>
        <div class="document-loading">
            <div class="document-loading-spinner"></div>
        </div>
        <p class="document-info">This may take a few seconds</p>
    </div>`;
}

// Create HTML for a generated document with download button
export function createDocumentResultHTML(documentUrl, text, title) {
    const uniqueId = 'doc-' + Date.now();
    const safeTitle = title ? escapeHTML(title).replace(/[^a-z0-9]/gi, '-') : 'document';
    const escapedTitle = title ? escapeHTML(title) : 'Generated Document';
    
    // Create a direct download link with improved styling
    return `<div class="generated-document-container">
        <div class="document-header">
            <h3>${escapedTitle}</h3>
            <p>Document generated successfully</p>
        </div>
        <div class="document-preview">
            <div class="document-icon">
                <span class="material-symbols-rounded">description</span>
            </div>
            <div class="document-info">
                <div class="document-title">${escapedTitle}</div>
                <div class="document-format">Word Document (.doc)</div>
            </div>
            <div class="document-actions">
                <a href="${documentUrl}" class="download-document-btn" download="${safeTitle}.doc">
                    <span class="material-symbols-rounded" style="color: white !important;">download</span>
                </a>
            </div>
        </div>
    </div>`;
}

// Utility function to escape HTML characters
export function escapeHTML(str) {
  if (typeof str !== 'string') {
    // It's good practice to handle non-string inputs, 
    // though in this context title is expected to be a string.
    // Returning an empty string or the original input as is are options.
    return ''; 
  }
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}
