import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generatePlanningContent(prompt: string, model: string = 'gemini-2.5-flash') {
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return result.text || '';
}

