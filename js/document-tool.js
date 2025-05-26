// Word Document Generation Tool for Gemini API
import { generateDocument } from './document-generator.js';
import { createDocumentResultHTML } from './document-utils.js';

// Define the document generation tool schema
export const documentGenerationTool = {
  name: "generateDocument",
  description: "Generates a Word document based on content provided by the user.",
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The content to include in the Word document. This can be formatted text that will be converted to a document. Markdown formatting is supported."
      },
      title: {
        type: "string",
        description: "Title for the document. If not provided, a title will be generated based on the content."
      }
    },
    required: ["content"]
  }
};

// Function to handle the document generation tool call
export async function handleDocumentGenerationToolCall(toolCall, apiKey) {
  try {
    // Extract the parameters from the tool call
    let content, title;
    if (toolCall.functionCall.args) {
      content = toolCall.functionCall.args.content;
      title = toolCall.functionCall.args.title;
    } else if (toolCall.functionCall.arguments) {
      if (typeof toolCall.functionCall.arguments === 'string') {
        const params = JSON.parse(toolCall.functionCall.arguments);
        content = params.content;
        title = params.title;
      } else {
        content = toolCall.functionCall.arguments.content;
        title = toolCall.functionCall.arguments.title;
      }
    }
    
    if (!content) {
      console.error("No content found in function call:", toolCall);
      return {
        name: toolCall.functionCall.name,
        content: {
          error: "No content provided. Please provide the content for the document you want to generate."
        }
      };
    }
    
    console.log(`Generating document with content length: ${content.length}`);
    
    // Generate the document using our function - it now returns a blob
    const result = await generateDocument(content, title, apiKey);
    
    if (result.success && result.docBlob) {
      const docUrl = URL.createObjectURL(result.docBlob);
      const documentTitleToUse = result.documentTitle || title || 'Generated Document';
      
      const htmlContent = createDocumentResultHTML(docUrl, result.message, documentTitleToUse);

      // Revoke the object URL after a delay to allow the user to download
      setTimeout(() => {
        URL.revokeObjectURL(docUrl);
        console.log(`Revoked object URL for document: ${documentTitleToUse}`);
      }, 60000); // 1 minute delay

      return {
        name: toolCall.functionCall.name,
        content: {
          documentUrl: docUrl, // This URL is now temporary
          documentTitle: documentTitleToUse,
          text: `I've created a document titled "${documentTitleToUse}" based on your content.`,
          html: htmlContent 
        }
      };
    } else {
      // Handle error case from generateDocument or if docBlob is missing
      return {
        name: toolCall.functionCall.name,
        content: {
          error: result.error || "An error occurred while generating the document blob."
        }
      };
    }
  } catch (error) {
    console.error("Error in document generation tool:", error);
    
    return {
      name: toolCall.functionCall.name,
      content: {
        error: error.message || "An unexpected error occurred while handling the document generation."
      }
    };
  }
}

// Note: We don't need a separate processDocumentToolCalls function
// The existing processToolCalls in image-tool.js will be updated to handle document generation
// This is done by adding our tool to the function declarations array in script.js
