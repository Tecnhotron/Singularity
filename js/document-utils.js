// Document Utilities for Singularity

// Create a loading placeholder for document generation
export function createDocumentLoadingPlaceholder(title) {
    return `<div class="generated-document-container">
        <p>Generating your document${title ? ` titled "${title}"` : ''}...</p>
        <div class="document-loading">
            <div class="document-loading-spinner"></div>
        </div>
        <p class="document-info">This may take a few seconds</p>
    </div>`;
}

// Create HTML for a generated document with download button
export function createDocumentResultHTML(documentUrl, text, title) {
    const uniqueId = 'doc-' + Date.now();
    const safeTitle = title ? title.replace(/[^a-z0-9]/gi, '-') : 'document';
    
    // Create a direct download link with improved styling
    return `<div class="generated-document-container">
        <div class="document-header">
            <h3>${title || 'Generated Document'}</h3>
            <p>Document generated successfully</p>
        </div>
        <div class="document-preview">
            <div class="document-icon">
                <span class="material-symbols-rounded">description</span>
            </div>
            <div class="document-info">
                <div class="document-title">${title || 'Generated Document'}</div>
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

// Function to handle document download (to be called from onclick)
window.downloadGeneratedDocument = function(documentId, title) {
    const docElement = document.getElementById(documentId);
    if (!docElement) return;
    
    const documentUrl = docElement.getAttribute('data-url');
    if (!documentUrl) return;
    
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = `${title || 'generated-document'}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show a toast notification
    if (window.showToast) {
        window.showToast('Document download started');
    }
};
