import apiService from './api';
import type { ApiResponse } from '../types';

class AiApiService {
  /**
   * Generate AI content via the backend's Vercel AI Gateway integration
   */
  async generateContent(prompt: string, model: string = 'gpt-4o', systemMessage?: string): Promise<ApiResponse<{ text: string }>> {
    // We are using the protected Axios client from api.ts to ensure auth headers are included
    const response = await apiService['client'].post('/ai/generate', {
      prompt,
      model,
      systemMessage
    });
    return response.data;
  }

  /**
   * Chat endpoint (compatible with Vercel AI SDK messages format)
   */
  async chat(messages: any[], model: string = 'gpt-4o', systemMessage?: string): Promise<ApiResponse<{ text: string }>> {
    const response = await apiService['client'].post('/ai/chat', {
      messages,
      model,
      systemMessage
    });
    return response.data;
  }
}

export const aiApiService = new AiApiService();
export default aiApiService;
