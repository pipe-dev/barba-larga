
'use server';

/**
 * @fileOverview AI-powered style advisor — optimized for speed.
 * Uses gemini-2.5-flash with a condensed prompt.
 * Exports both a standard function and a streaming API.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { services } from '@/lib/data';

const AIStyleAdvisorInputSchema = z.object({
  genderIdentity: z.string().describe("Client's gender identity."),
  stylePreferences: z.string().describe("Client's style preferences."),
});
export type AIStyleAdvisorInput = z.infer<typeof AIStyleAdvisorInputSchema>;

const AIStyleAdvisorOutputSchema = z.object({
  recommendations: z.string().describe('Personalized style recommendations in plain text (no markdown).'),
  suggestedServices: z.string().describe('Names of suggested services from the catalog.'),
  suggestedServiceIds: z.array(z.string()).describe('IDs of suggested services from the catalog.'),
  styleImageKey: z.string().describe('One of: french-crop, degradado-natural, texturizado, mullet-moderno, faux-hawk, corte-militar, bob, shaggy, coloracion, diseno-rapado'),
});
export type AIStyleAdvisorOutput = z.infer<typeof AIStyleAdvisorOutputSchema>;

export async function aiStyleAdvisor(input: AIStyleAdvisorInput): Promise<AIStyleAdvisorOutput> {
  return aiStyleAdvisorFlow(input);
}

// Condensed prompt — ~60% shorter than original
const promptTemplate = `Eres el asesor de estilo IA de Barba Larga (barbería). Responde en español, sin markdown, texto plano.

INSTRUCCIONES:
1. Empieza con una frase positiva corta
2. Da una recomendación concisa basada en tendencias 2025 y las preferencias del cliente
3. Sugiere 1-2 servicios del catálogo (prefiere combos sobre servicios individuales)
4. Termina con: "pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita"

REGLAS de servicios:
- Si recomiendas color → sugiere "Coloración Estratégica" (ID: coloring)
- Si recomiendas diseño → sugiere "Corte + Diseño y Cejas" (ID: haircut-design-eyebrows)
- Si recomiendas corte + barba → sugiere "Experiencia Dominante" en vez de ambos por separado

TENDENCIAS 2025 (resumen):
Hombre: degradado natural, texturizado, mullet moderno, faux hawk, french crop, corte militar
Mujer: bobs, shaggy, capas, flequillos de cortina
Color: mocha mousse, cobrizos, contouring capilar, rubio avellana, rojo cereza
Diseño: microdiseños rapados, acabado natural y texturizado

styleImageKey — elige UNO:
french-crop | degradado-natural | texturizado | mullet-moderno | faux-hawk | corte-militar | bob | shaggy | coloracion | diseno-rapado

Cliente: {{{genderIdentity}}}
Preferencias: {{{stylePreferences}}}

Catálogo (ID: Nombre):
{{{serviceCatalog}}}`;

const outputSchema = z.object({
  recommendations: z.string().describe('Recomendación personalizada en texto plano.'),
  suggestedServices: z.string().describe('Nombres de los servicios sugeridos.'),
  suggestedServiceIds: z.array(z.string()).describe('IDs de los servicios sugeridos del catálogo.'),
  styleImageKey: z.string().describe('Clave de imagen: french-crop|degradado-natural|texturizado|mullet-moderno|faux-hawk|corte-militar|bob|shaggy|coloracion|diseno-rapado'),
});

function buildPrompt(input: AIStyleAdvisorInput): string {
  const serviceCatalog = services.map(s => `${s.id}: ${s.name}`).join('\n');
  return promptTemplate
    .replace('{{{genderIdentity}}}', input.genderIdentity)
    .replace('{{{stylePreferences}}}', input.stylePreferences)
    .replace('{{{serviceCatalog}}}', serviceCatalog);
}

const aiStyleAdvisorFlow = ai.defineFlow(
  {
    name: 'aiStyleAdvisorFlow',
    inputSchema: AIStyleAdvisorInputSchema,
    outputSchema: AIStyleAdvisorOutputSchema,
  },
  async input => {
    // Shim: Allow GEMINI_API_KEY to work for Genkit if GOOGLE_GENAI_API_KEY is missing
    if (!process.env.GOOGLE_GENAI_API_KEY && process.env.GEMINI_API_KEY) {
      process.env.GOOGLE_GENAI_API_KEY = process.env.GEMINI_API_KEY;
    }

    try {
      const { output } = await ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt: buildPrompt(input),
        output: { format: 'json', schema: outputSchema },
      });

      if (!output) {
        console.error("❌ AI Style Advisor (Server Action) returned no output.");
        throw new Error("No se pudo obtener respuesta del asesor de estilo.");
      }

      return output;
    } catch (error) {
      console.error("❌ Error in AI Style Advisor (Server Action):", error);
      throw error;
    }
  }


);
