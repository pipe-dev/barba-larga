
'use server';

/**
 * @fileOverview AI-powered style advisor — uses Groq API (free tier).
 * Model: llama-3.3-70b-versatile (fast, free, supports JSON mode).
 * Exports the same interface so the client doesn't need changes.
 */

import { z } from 'zod';
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

// Condensed prompt for fast responses
const systemPrompt = `Eres el asesor de estilo IA de Barba Larga (barbería colombiana). Responde SIEMPRE en español, texto plano, SIN markdown. Sé breve y directo (máximo 3-4 oraciones).

INSTRUCCIONES:
1. Empieza con una frase positiva corta
2. Da una recomendación concisa basada en tendencias 2025
3. Sugiere 1-2 servicios del catálogo
4. Termina con: "pregunta a tu asesor humano qué otros productos y servicios tienen para ti"

REGLAS de servicios:
- Color → sugiere "Coloración Estratégica" (ID: coloring)
- Diseño → sugiere "Corte + Diseño y Cejas" (ID: haircut-design-eyebrows)
- Corte + barba → sugiere "Experiencia Dominante" en vez de ambos separados

TENDENCIAS 2025:
Hombre: degradado natural, texturizado, mullet moderno, faux hawk, french crop, corte militar
Mujer: bobs, shaggy, capas, flequillos de cortina
Color: mocha mousse, cobrizos, rubio avellana, rojo cereza

styleImageKey — elige UNO: french-crop | degradado-natural | texturizado | mullet-moderno | faux-hawk | corte-militar | bob | shaggy | coloracion | diseno-rapado

Responde ÚNICAMENTE con un JSON válido (sin texto extra) con esta estructura:
{
  "recommendations": "texto plano con tu recomendación",
  "suggestedServices": "nombres de los servicios sugeridos",
  "suggestedServiceIds": ["id1", "id2"],
  "styleImageKey": "clave-de-imagen"
}`;

export async function aiStyleAdvisor(input: AIStyleAdvisorInput): Promise<AIStyleAdvisorOutput> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY not set in environment variables.");
    throw new Error("El asesor de estilo no está configurado. Contacta al administrador.");
  }

  const serviceCatalog = services.map(s => `${s.id}: ${s.name}`).join('\n');

  const userMessage = `Cliente: ${input.genderIdentity}
Preferencias: ${input.stylePreferences}

Catálogo (ID: Nombre):
${serviceCatalog}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Groq API error (${response.status}):`, errorBody);
      throw new Error("Error al consultar el asesor de estilo. Inténtalo de nuevo.");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("❌ Groq returned empty content:", data);
      throw new Error("No se pudo obtener respuesta del asesor de estilo.");
    }

    // Parse and validate the JSON response
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("❌ Failed to parse Groq response as JSON:", content);
      throw new Error("Respuesta inesperada del asesor. Inténtalo de nuevo.");
    }

    const validated = AIStyleAdvisorOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("❌ Groq response doesn't match schema:", validated.error.issues);
      // Try to salvage what we can
      const fallback = parsed as Record<string, unknown>;
      return {
        recommendations: String(fallback.recommendations || "No se pudo generar una recomendación. Intenta de nuevo."),
        suggestedServices: String(fallback.suggestedServices || ""),
        suggestedServiceIds: Array.isArray(fallback.suggestedServiceIds) ? fallback.suggestedServiceIds.map(String) : [],
        styleImageKey: String(fallback.styleImageKey || "degradado-natural"),
      };
    }

    return validated.data;

  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Error al consultar")) {
      throw error;
    }
    console.error("❌ Error in AI Style Advisor:", error);
    throw new Error("Error inesperado al consultar el asesor de estilo.");
  }
}
