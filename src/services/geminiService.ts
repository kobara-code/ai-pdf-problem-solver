import { GoogleGenAI, Type } from "@google/genai";
import { Problem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function parseProblemsFromPDF(fileBase64: string, mimeType: string): Promise<{ title: string; problems: Problem[] }> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Extract all problems from this PDF. 
            For each problem, provide:
            1. The question text.
            2. Multiple choice options (if any).
            3. The correct answer.
            4. A brief explanation.
            
            Return the data in JSON format with a 'title' for the set and an array of 'problems'.
            Each problem should have: id (unique string), question, options (array of strings), answer, explanation.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          problems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ["id", "question", "answer", "explanation"],
            },
          },
        },
        required: ["title", "problems"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Failed to parse PDF");
  return JSON.parse(text);
}
