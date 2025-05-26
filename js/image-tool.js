// Image Generation Tool for Gemini API
import { generateImage } from './image-generator.js';

// Define the image generation tool schema
export const imageGenerationTool = {
  name: "generateImage",
  description: "Generates an image based on a text description provided by the user.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "A detailed description of the image to generate. Be specific about what you want to see in the image."
      }
    },
    required: ["prompt"]
  }
};

// Function to handle the image generation tool call
export async function handleImageGenerationToolCall(toolCall, apiKey) {
  try {
    // Extract the prompt from the tool call parameters
    // Handle both formats: args and arguments
    let prompt;
    if (toolCall.functionCall.args) {
      // Format: { args: { prompt: "..." } }
      prompt = toolCall.functionCall.args.prompt;
    } else if (toolCall.functionCall.arguments) {
      // Format: { arguments: "{\"prompt\":\"...\"}"
      // Check if it's already an object or a string that needs parsing
      if (typeof toolCall.functionCall.arguments === 'string') {
        const params = JSON.parse(toolCall.functionCall.arguments);
        prompt = params.prompt;
      } else {
        prompt = toolCall.functionCall.arguments.prompt;
      }
    }
    
    if (!prompt) {
      console.error("No prompt found in function call:", toolCall);
      return {
        name: toolCall.functionCall.name,
        content: {
          error: "No prompt provided. Please provide a description of the image you want to generate."
        }
      };
    }
    
    console.log(`Generating image with prompt: ${prompt}`);
    
    // Generate the image using our existing function
    const result = await generateImage(prompt, apiKey);
    
    // Return the result in the format expected by the Gemini API
    return {
      name: toolCall.functionCall.name,
      content: {
        imageUrl: result.imageUrl,
        text: result.text || "Image generated successfully."
      }
    };
  } catch (error) {
    console.error("Error in image generation tool:", error);
    
    // Return error information
    return {
      name: toolCall.functionCall.name,
      content: {
        error: error.message || "An error occurred while generating the image."
      }
    };
  }
}

// Function to process tool calls from the Gemini API response
export async function processToolCalls(toolCalls, apiKey) {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }
  
  const toolResponses = [];
  
  for (const toolCall of toolCalls) {
    if (toolCall.functionCall) {
      if (toolCall.functionCall.name === "generateImage") {
        const response = await handleImageGenerationToolCall(toolCall, apiKey);
        toolResponses.push(response);
      } else if (toolCall.functionCall.name === "generateDocument") {
        // Import dynamically to avoid circular dependencies
        const { handleDocumentGenerationToolCall } = await import('./document-tool.js');
        const response = await handleDocumentGenerationToolCall(toolCall, apiKey);
        toolResponses.push(response);
      }
    }
  }
  
  return toolResponses;
}
