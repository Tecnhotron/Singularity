// Image Generation using the Gemini API directly (same approach as main chat)

// Function to generate an image based on a text prompt
export async function generateImage(prompt, apiKey = null) {
  // Use the apiKey from parameters or fall back to state.user.apiKey
  if (!apiKey && window.state && window.state.user) {
    apiKey = window.state.user.apiKey;
  }
  
  if (!apiKey) {
    throw new Error("API key is required for image generation");
  }

  // Use the same image generation model as specified in the main chat
  const model = "gemini-2.0-flash-preview-image-generation";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    // Prepare the request body - similar to the main chat functionality
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 1,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192
      }
    };

    // Make API request - same approach as in getGeminiResponse
    console.log('Image generation API request sent:', requestBody);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Image generation API response received:', data);

    // Check for errors
    if (data.error) {
      if (data.error.code === 400) {
        throw new Error("Invalid API request. Please check your API key and try again.");
      } else if (data.error.code === 403) {
        throw new Error("API access forbidden. Your API key may not have access to this model.");
      } else {
        throw new Error(data.error.message || 'Unknown error occurred');
      }
    }

    // Check for blocked content
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error(`Your image request was blocked due to ${data.promptFeedback.blockReason.toLowerCase()} content.`);
    }

    // Check if we have a valid response
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Couldn't generate an image. Please try again with a different prompt.");
    }

    // Extract the text and image data from the response
    const candidate = data.candidates[0];
    const parts = candidate.content.parts;
    
    let text = "";
    let imageUrl = null;
    
    // Process each part of the response
    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    return {
      text: text || "Here's the image I generated based on your prompt.",
      imageUrl: imageUrl
    };
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

// Function to check if image generation is available
export function isImageGenerationAvailable() {
  // Check if we have an API key in the state
  return window.state && window.state.user && !!window.state.user.apiKey;
}
