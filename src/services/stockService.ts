import { GoogleGenAI, Type } from "@google/genai";
import { StockData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function fetchStockData(symbol: string): Promise<StockData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Search the web for the latest, real-time stock market data for ${symbol}. Provide the current price, the currency of the price (e.g., USD, INR), price change, percentage change, and a 7-day price history (date and price). Return the data in JSON format.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          symbol: { type: Type.STRING },
          name: { type: Type.STRING },
          price: { type: Type.NUMBER },
          currency: { type: Type.STRING, description: "The currency code, e.g., USD or INR" },
          change: { type: Type.NUMBER },
          changePercent: { type: Type.NUMBER },
          history: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                price: { type: Type.NUMBER }
              },
              required: ["date", "price"]
            }
          }
        },
        required: ["symbol", "name", "price", "currency", "change", "changePercent", "history"]
      }
    }
  });

  const data = JSON.parse(response.text || "{}");
  return data as StockData;
}

export async function searchStocks(query: string): Promise<{ symbol: string; name: string }[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Search for stock symbols matching "${query}". Return a list of up to 5 matching stocks with their symbol and full company name. Return the data in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            name: { type: Type.STRING }
          },
          required: ["symbol", "name"]
        }
      }
    }
  });

  const data = JSON.parse(response.text || "[]");
  return data;
}
