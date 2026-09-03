import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServicesFromDB } from '@/app/actions/services';
import { aiStyleAdvisor } from '@/ai/flows/ai-style-advisor';

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
- Si recomiendas corte + barba → sugiere "Corte de cabello con Barba" (ID: haircut-beard) o "Barba combo" (ID: beard-combo)
- Si recomiendas cejas → sugiere "Corte de cabello con ceja" (ID: haircut-eyebrows) o "Cejas con cuchilla" (ID: eyebrows)
- Si recomiendas diseño → sugiere "Corte de cabello con diseño" (ID: haircut-design)
- Si recomiendas mascarilla / exfoliación → sugiere "Corte de cabello más mascarilla de exfoliación" (ID: haircut-facial-mask)
- Si recomiendas corte estándar → sugiere "Corte de cabello" (ID: haircut)

REGLAS CRÍTICAS DE GÉNERO:
- Si el cliente es HOMBRE (o selecciona Masculino): recomienda ÚNICAMENTE cortes masculinos de barbería: degradado-natural, french-crop, texturizado, mullet-moderno, faux-hawk, corte-militar o diseno-rapado. JAMÁS elijas estilos femeninos para clientes hombres.
- Si el cliente es MUJER: puedes sugerir bob, shaggy o coloracion.

styleImageKey — elige UNO:
Para Hombre: french-crop | degradado-natural | texturizado | mullet-moderno | faux-hawk | corte-militar | diseno-rapado
Para Mujer: bob | shaggy | coloracion

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
        const { genderIdentity, stylePreferences } = await req.json();

        if (!genderIdentity || !stylePreferences) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const GROQ_API_KEY = process.env.GROQ_API_KEY;

        if (!GROQ_API_KEY) {
            console.log("ℹ️ GROQ_API_KEY not set, activating built-in expert stylist engine.");
            const fallbackAdvice = await aiStyleAdvisor({ genderIdentity, stylePreferences });
            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ partial: fallbackAdvice.recommendations, accumulated: fallbackAdvice.recommendations })}\n\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: fallbackAdvice })}\n\n`));
                    controller.close();
                }
            });
            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        const dbServices = await getServicesFromDB();
        const serviceCatalog = dbServices.map(s => `${s.id}: ${s.name}`).join('\n');
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
            console.warn(`⚠️ Groq API responded with status ${response.status}, falling back to built-in stylist.`);
            const fallbackAdvice = await aiStyleAdvisor({ genderIdentity, stylePreferences });
            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ partial: fallbackAdvice.recommendations, accumulated: fallbackAdvice.recommendations })}\n\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: fallbackAdvice })}\n\n`));
                    controller.close();
                }
            });
            return new Response(readableStream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
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
                        const isFemale = (genderIdentity || '').toLowerCase().includes('femenin') || (genderIdentity || '').toLowerCase().includes('mujer');
                        if (!isFemale && (parsed.styleImageKey === 'bob' || parsed.styleImageKey === 'shaggy')) {
                            parsed.styleImageKey = 'degradado-natural';
                        }
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
