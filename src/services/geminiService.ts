import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface DetectionResult {
  crop: string;
  disease: string;
  localName: string;
  confidence: number;
  description: string;
  treatment: {
    irrigation: string;
    pesticide: string;
    pruning: string;
  };
}

export const analyzeCropDisease = async (base64Image: string, language: 'en' | 'ml'): Promise<DetectionResult> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this crop leaf image for diseases common in Kerala, India.
    Target Crops: Coconut, Rubber, Banana, Paddy, Black Pepper.
    
    Specific diseases to look for:
    - Coconut: Root (Wilt) Disease (Kattuveezhcha), Bud Rot (Karimpana)
    - Paddy: Rice Blast (Polla Rogam), Brown Spot (Uyila Rogam)
    - Banana: Sigatoka Leaf Spot, Bunchy Top (Thalayilla Kunnampuzha)
    - Rubber: Abnormal Leaf Fall (Ila Pozhichil)
    - Black Pepper: Quick Wilt (Foot Rot / Drutha Vaatam)
    
    Provide the result in ${language === 'ml' ? 'Malayalam' : 'English'}.
    If Malayalam is selected, ensure the 'localName' and 'description' and 'treatment' steps are in Malayalam script.
    
    Return a JSON object matching this schema:
    {
      "crop": "Crop name",
      "disease": "Disease name in English",
      "localName": "Local name in Malayalam (even if English is selected, provide the Malayalam name here too)",
      "confidence": number (0-100),
      "description": "Short description of the disease",
      "treatment": {
        "irrigation": "Irrigation advice",
        "pesticide": "Pesticide/Organic advice",
        "pruning": "Pruning/Action advice"
      }
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(",")[1] || base64Image,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          crop: { type: Type.STRING },
          disease: { type: Type.STRING },
          localName: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          description: { type: Type.STRING },
          treatment: {
            type: Type.OBJECT,
            properties: {
              irrigation: { type: Type.STRING },
              pesticide: { type: Type.STRING },
              pruning: { type: Type.STRING },
            },
            required: ["irrigation", "pesticide", "pruning"],
          },
        },
        required: ["crop", "disease", "localName", "confidence", "description", "treatment"],
      },
    },
  });

  return JSON.parse(response.text);
};
