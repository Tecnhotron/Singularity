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
    // Handle both formats: args and arguments
    let content, title;
    if (toolCall.functionCall.args) {
      // Format: { args: { content: "...", title: "..." } }
      content = toolCall.functionCall.args.content;
      title = toolCall.functionCall.args.title;
    } else if (toolCall.functionCall.arguments) {
      // Format: { arguments: "{\"content\":\"...\",\"title\":\"...\"}"
      // Check if it's already an object or a string that needs parsing
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
    
    // Generate the document using our function - now does direct generation without additional API call
    const result = await generateDocument(content, title, apiKey);
    
    // Return the result in the format expected by the Gemini API
    if (result.success) {
      // Create a properly formatted document result that will render correctly in the chat
      return {
        name: toolCall.functionCall.name,
        content: {
          documentUrl: result.documentUrl,
          documentTitle: result.documentTitle,
          text: `I've created a document titled "${result.documentTitle || 'Generated Document'}" based on your content.`,
          // Use the existing createDocumentResultHTML function from document-utils.js
          html: createDocumentResultHTML(result.documentUrl, result.message, result.documentTitle || title || 'Generated Document')
        }
      };
    } else {
      // Handle error case
      return {
        name: toolCall.functionCall.name,
        content: {
          error: result.error || "An error occurred while generating the document."
        }
      };
    }
  } catch (error) {
    console.error("Error in document generation tool:", error);
    
    // Return error information
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
