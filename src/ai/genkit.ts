import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  // Remove the default model here to allow flows to specify their own,
  // including multi-modal ones.
  // model: 'googleai/gemini-2.5-flash',
});
