import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { services } from '@/lib/data';

const outputSchema = z.object({
    recommendations: z.string().describe('Recomendación personalizada en texto plano.'),
    suggestedServices: z.string().describe('Nombres de los servicios sugeridos.'),
    suggestedServiceIds: z.array(z.string()).describe('IDs de los servicios sugeridos del catálogo.'),
    styleImageKey: z.string().describe('Clave de imagen: french-crop|degradado-natural|texturizado|mullet-moderno|faux-hawk|corte-militar|bob|shaggy|coloracion|diseno-rapado'),
});

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


export const maxDuration = 60; // Allow up to 60 seconds for AI generation

export async function POST(req: NextRequest) {
    try {
        // Shim: Allow GEMINI_API_KEY to work for Genkit if GOOGLE_GENAI_API_KEY is missing
        if (!process.env.GOOGLE_GENAI_API_KEY && process.env.GEMINI_API_KEY) {
            process.env.GOOGLE_GENAI_API_KEY = process.env.GEMINI_API_KEY;
        }

        // Debug: Check if API key is present (don't log the key itself)
        if (!process.env.GOOGLE_GENAI_API_KEY) {
            console.error("❌ GOOGLE_GENAI_API_KEY is missing in environment variables! (Checked GEMINI_API_KEY too)");
        }

        const { genderIdentity, stylePreferences } = await req.json();

        if (!genderIdentity || !stylePreferences) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const serviceCatalog = services.map(s => `${s.id}: ${s.name}`).join('\n');
        const fullPrompt = promptTemplate
            .replace('{{{genderIdentity}}}', genderIdentity)
            .replace('{{{stylePreferences}}}', stylePreferences)
            .replace('{{{serviceCatalog}}}', serviceCatalog);

        console.log("🚀 Starting AI Style Advisor generation...");

        const { stream, response } = await ai.generateStream({
            model: 'googleai/gemini-2.5-flash',
            prompt: fullPrompt,
            output: { format: 'json', schema: outputSchema },
        });

        // Create a ReadableStream that sends chunks as they arrive
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    let accumulated = '';
                    for await (const chunk of stream) {
                        const text = chunk.text;
                        if (text) {
                            accumulated += text;
                            // Send each chunk as a SSE-like message
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ partial: text, accumulated })}\n\n`));
                        }
                    }

                    // Wait for the final response and get the structured output
                    const finalResponse = await response;
                    const output = finalResponse.output;

                    if (output) {
                        console.log("✅ AI generation completed successfully.");
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: output })}\n\n`));
                    } else {
                        console.error("❌ AI generation finished but returned no output.");
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, error: 'No output from AI' })}\n\n`));
                    }
                } catch (err) {
                    console.error("❌ Error during stream processing:", err);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, error: String(err) })}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err) {
        console.error("❌ Fatal error in style-advisor API:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
