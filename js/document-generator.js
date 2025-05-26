// Document Generation directly from user content

// Function to generate a Word document based on content
export async function generateDocument(content, title = null, apiKey = null) {
  // Use the apiKey from parameters or fall back to state.user.apiKey
  if (!apiKey && window.state && window.state.user) {
    apiKey = window.state.user.apiKey;
  }
  
  if (!apiKey) {
    throw new Error("API key is required for document generation");
  }

  try {
    // Create a default title if none provided
    const documentTitle = title || "Generated Document";
    
    console.log('Starting direct document generation with content:', content.substring(0, 100) + '...');
    
    // Generate Word document directly from the provided content without additional API call
    const formattedContent = formatContentForWord(content);
    const docBlob = await generateWordDocumentBlob(documentTitle, formattedContent);
    
    // Create a download URL for the document
    const docUrl = URL.createObjectURL(docBlob);
    
    console.log('Document generation completed');

    return {
      success: true,
      documentUrl: docUrl,
      documentTitle: documentTitle,
      message: "Document generated successfully"
    };
  } catch (error) {
    console.error("Error generating document:", error);
    
    // Return a structured error response instead of throwing
    return {
      success: false,
      error: error.message || "An error occurred during document generation"
    };
  }
}

// Helper function to generate a Word document blob
function generateWordDocumentBlob(title, content) {
  // Create a more advanced Word document using HTML that Word can open
  const wordContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page {
          size: 21.59cm 27.94cm;
          margin: 2cm;
        }
        body {
          font-family: 'Calibri', sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #333333;
        }
        h1 {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 12pt;
          color: #1a1a1a;
          border-bottom: 1px solid #dddddd;
          padding-bottom: 6pt;
        }
        h2 {
          font-size: 14pt;
          font-weight: bold;
          margin-top: 14pt;
          margin-bottom: 10pt;
          color: #333333;
        }
        h3 {
          font-size: 12pt;
          font-weight: bold;
          margin-top: 12pt;
          margin-bottom: 8pt;
          color: #4d4d4d;
        }
        p {
          margin-bottom: 10pt;
        }
        ul, ol {
          margin-bottom: 10pt;
          padding-left: 2cm;
        }
        li {
          margin-bottom: 5pt;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 10pt;
        }
        th {
          background-color: #f2f2f2;
          border: 1px solid #d9d9d9;
          padding: 8pt;
          text-align: left;
          font-weight: bold;
        }
        td {
          border: 1px solid #d9d9d9;
          padding: 8pt;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${formatContentForWord(content)}
    </body>
    </html>
  `;

  // Create a Blob with the document content
  // Using application/msword for .doc format
  const blob = new Blob([wordContent], { type: 'application/msword' });
  return blob;
}

// Helper function to format content for Word document
function formatContentForWord(content) {
  // First, handle line breaks indicated by ---
  content = content.replace(/---/g, '<br style="page-break-before:always">');
  
  // Enhanced formatting with better Markdown support
  // Split by double newlines to identify paragraphs
  let formatted = content
    .split(/\n\n+/)
    .map(paragraph => {
      // Check if it's a heading (starts with # or ##)
      if (/^#{1,6}\s/.test(paragraph)) {
        const level = paragraph.match(/^(#{1,6})\s/)[1].length;
        const text = paragraph.replace(/^#{1,6}\s/, '');
        return `<h${level}>${text}</h${level}>`;
      }
      
      // Check if it's a list item
      if (/^[-*]\s/.test(paragraph)) {
        return `<ul>${paragraph.split('\n').map(item => 
          `<li>${item.replace(/^[-*]\s/, '')}</li>`
        ).join('')}</ul>`;
      }
      
      // Check if it's a numbered list
      if (/^\d+\.\s/.test(paragraph)) {
        return `<ol>${paragraph.split('\n').map(item => 
          `<li>${item.replace(/^\d+\.\s/, '')}</li>`
        ).join('')}</ol>`;
      }
      
      // Check if it's a code block
      if (paragraph.startsWith('```') && paragraph.endsWith('```')) {
        const code = paragraph.substring(3, paragraph.length - 3).trim();
        return `<pre style="background-color: #f6f8fa; padding: 12pt; border-radius: 5pt; font-family: 'Courier New', monospace; font-size: 10pt;">${code}</pre>`;
      }
      
      // Check if it's a blockquote
      if (/^>\s/.test(paragraph)) {
        return `<blockquote style="border-left: 4pt solid #dddddd; padding-left: 10pt; margin-left: 10pt; color: #666666;">${paragraph.replace(/^>\s/, '')}</blockquote>`;
      }
      
      // Process math expressions enclosed in $...$
      let processedText = paragraph;
      
      // Handle inline math expressions ($...$)
      const mathRegex = /\$(.*?)\$/g;
      processedText = processedText.replace(mathRegex, (match, formula) => {
        // Return Word-compatible math equation
        return `<span style="font-family: 'Cambria Math', serif; font-style: italic;">${formula}</span>`;
      });
      
      // Process other inline formatting (bold, italic, links)
      processedText = processedText
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'); // Links
      
      // Regular paragraph
      return `<p>${processedText.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
    
  return formatted;
}

// Function to check if document generation is available
export function isDocumentGenerationAvailable() {
  // Check if the browser supports the necessary features
  return true; // Always available as it uses basic browser features
}
