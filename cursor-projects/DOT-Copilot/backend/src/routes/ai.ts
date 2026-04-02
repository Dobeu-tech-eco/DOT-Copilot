import express from 'express';
import { generateAIContent } from '../services/ai';
import { logError } from '../services/logger';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { prompt, model, systemMessage } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const text = await generateAIContent(prompt, model, systemMessage);

    res.json({ text });
  } catch (error) {
    logError('AI generation route error', error as Error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { messages, model, systemMessage } = req.body;

    let prompt = '';

    if (Array.isArray(messages) && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        prompt = lastMessage.content;
      }
    } else if (req.body.prompt) {
      prompt = req.body.prompt;
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt or messages array is required' });
    }

    const text = await generateAIContent(prompt, model, systemMessage);

    res.json({ text });
  } catch (error) {
    logError('AI chat route error', error as Error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

export default router;
