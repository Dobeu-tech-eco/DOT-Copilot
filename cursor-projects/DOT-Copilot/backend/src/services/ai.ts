import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logError } from './logger';

// Retrieve AI gateway credentials
// The AI Gateway ID should be configured in Vercel project settings
const gatewayId = process.env.VERCEL_AI_GATEWAY_ID || 'my-ai-gateway';
const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY || '';

// Configure the OpenAI provider to use Vercel AI Gateway
// Reference: https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/advanced
const openai = createOpenAI({
  apiKey,
  baseURL: `https://ai-gateway.vercel.sh/v1/${gatewayId}/openai`,
});

// Configure gateway routing options to prioritize providers
// Reference: https://vercel.com/docs/ai-gateway/models-and-providers/provider-options
const defaultProviderOptions = {
  gateway: {
    // If OpenAI is unavailable, fallback to Anthropic
    order: ['openai', 'anthropic'],
  },
};

export async function generateAIContent(prompt: string, model: string = 'gpt-4o', systemMessage?: string) {
  try {
    const { text } = await generateText({
      model: openai(model),
      system: systemMessage || 'You are a helpful assistant for the DOT-Copilot fleet management platform.',
      prompt,
      providerOptions: defaultProviderOptions,
    });
    return text;
  } catch (error) {
    logError('Error generating AI content via Vercel AI Gateway', error as Error);
    throw new Error('Failed to generate AI content');
  }
}

export async function streamAIContent(prompt: string, model: string = 'gpt-4o', systemMessage?: string) {
  try {
    const stream = await streamText({
      model: openai(model),
      system: systemMessage || 'You are a helpful assistant for the DOT-Copilot fleet management platform.',
      prompt,
      providerOptions: defaultProviderOptions,
    });
    return stream;
  } catch (error) {
    logError('Error streaming AI content via Vercel AI Gateway', error as Error);
    throw new Error('Failed to stream AI content');
  }
}
