import { NextRequest } from 'next/server';
import { z } from 'zod';
import { services } from '@/lib/data';

const outputSchema = z.object({
    recommendations: z.string().describe('Recomendación personalizada en texto plano.'),
    suggestedServices: z.string().describe('Nombres de los servicios sugeridos.'),
    suggestedServiceIds: z.array(z.string()).describe('IDs de los servicios sugeridos del catálogo.'),
    styleImageKey: z.string().describe('Clave de imagen: french-crop|degradado-natural|texturizado|mullet-moderno|faux-hawk|corte-militar|bob|shaggy|coloracion|diseno-rapado'),
});

const systemPrompt = `Eres el asesor de estilo IA de Barba Larga (barbería). Responde en español, sin markdown, texto plano.

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

Responde ÚNICAMENTE con un JSON válido (sin texto extra) con esta estructura:
{
  "recommendations": "texto plano con tu recomendación",
  "suggestedServices": "nombres de los servicios sugeridos",
  "suggestedServiceIds": ["id1", "id2"],
  "styleImageKey": "clave-de-imagen"
}`;


export const maxDuration = 60; // Allow up to 60 seconds for AI generation

export async function POST(req: NextRequest) {
    try {
        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GROQ_API_KEY) {
            console.error("❌ GROQ_API_KEY is missing in environment variables!");
            return new Response(JSON.stringify({ error: 'Configuración de IA faltante' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { genderIdentity, stylePreferences } = await req.json();

        if (!genderIdentity || !stylePreferences) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const serviceCatalog = services.map(s => `${s.id}: ${s.name}`).join('\n');
        const userMessage = `Cliente: ${genderIdentity}\nPreferencias: ${stylePreferences}\n\nCatálogo (ID: Nombre):\n${serviceCatalog}`;

        console.log("🚀 Starting AI Style Advisor generation (Groq Stream)...");

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
                stream: true, // We must parse the stream manually since Groq doesn't stream JSON objects well, but we'll simulate it for the client
            }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        const encoder = new TextEncoder();

        const readableStream = new ReadableStream({
            async start(controller) {
                try {
                    let accumulated = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    const text = data.choices[0]?.delta?.content || '';
                                    if (text) {
                                        accumulated += text;
                                        // Send partial chunk
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ partial: text, accumulated })}\n\n`));
                                    }
                                } catch (e) {
                                    // Ignore parse errors on partial chunks
                                }
                            }
                        }
                    }

                    // Done streaming, try to parse the final JSON
                    console.log("✅ AI generation completed stream.");
                    try {
                        // Extract JSON if it was wrapped in markdown blocks
                        const cleanJson = accumulated.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanJson);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: parsed })}\n\n`));
                    } catch (e) {
                        console.error("❌ Failed to parse final generated JSON:", accumulated);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, error: 'Respuesta inválida de IA' })}\n\n`));
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
