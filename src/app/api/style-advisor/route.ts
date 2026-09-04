import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServicesFromDB } from '@/app/actions/services';
import { aiStyleAdvisor } from '@/ai/flows/ai-style-advisor';
import { normalizeStyleKey } from '@/lib/style-images';

const outputSchema = z.object({
    recommendations: z.string().describe('Recomendación personalizada en texto plano.'),
    suggestedServices: z.string().describe('Nombres de los servicios sugeridos.'),
    suggestedServiceIds: z.array(z.string()).describe('IDs de los servicios sugeridos del catálogo.'),
    styleImageKey: z.string().describe('Clave de imagen: capas-largo|buzz-cut-militar|french-crop|mullet-moderno|pompadour-clasico|taper-fade-barba|skin-fade-clasico|faux-hawk|ondulado-taper|diseno-rayas'),
});

const systemPrompt = `Eres el asesor de estilo IA de Barba Larga (barbería colombiana). Responde SIEMPRE en español, texto plano, SIN markdown. Sé breve y directo (máximo 3-4 oraciones).

INSTRUCCIONES:
1. Empieza con una frase positiva corta personalizada.
2. Da una recomendación concisa de barbero basada en tendencias 2025/2026 y las preferencias del cliente.
3. Sugiere 1-2 servicios del catálogo (prefiere combos cuando aplique).
4. Termina con: "pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita".

10 ESTILOS MASCULINOS EN TENDENCIA (styleImageKey):
- capas-largo: Melena media o larga, cabello en capas, man bun, pelo recogido o suelto con caída natural.
- buzz-cut-militar: Rapado al cero, corte militar, rapado uniforme, sin peinado, fresco y limpio.
- french-crop: Flequillo recto o despuntado hacia adelante, textura superior, laterales desvanecidos (muy de moda).
- mullet-moderno: Laterales degradados con largo y volumen texturizado en la nuca / parte trasera.
- pompadour-clasico: Raya clásica ejecutiva, peinado hacia atrás o al lado, porte formal o clásico caballero.
- taper-fade-barba: Degradado sutil solo en patillas y cuello que conecta con barba perfilada a navaja.
- skin-fade-clasico: Degradado a piel al cero, contraste limpio y pulido en los costados.
- faux-hawk: Cresta moderna o puntas orientadas hacia el centro con degradado en los laterales.
- ondulado-taper: Textura rizada u ondulada con taper en los laterales para controlar volumen con movimiento natural.
- diseno-rayas: Diseños geométricos a navaja, líneas, grecas o hair tattoo sobre un degradado.

REGLAS DE SERVICIOS:
- Corte + Barba → "Corte de cabello con Barba" (ID: haircut-beard) o "Barba combo" (ID: beard-combo)
- Cejas → "Corte de cabello con ceja" (ID: haircut-eyebrows) o "Cejas con cuchilla" (ID: eyebrows)
- Diseño → "Corte de cabello con diseño" (ID: haircut-design)
- Mascarilla / Exfoliación → "Corte de cabello más mascarilla de exfoliación" (ID: haircut-facial-mask)
- Corte estándar → "Corte de cabello" (ID: haircut)

Responde ÚNICAMENTE con un JSON válido (sin markdown ni texto extra):
{
  "recommendations": "texto plano con tu recomendación y tip de barbero",
  "suggestedServices": "nombres de los servicios sugeridos",
  "suggestedServiceIds": ["id1", "id2"],
  "styleImageKey": "una-de-las-10-claves"
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
            console.log("ℹ️ GROQ_API_KEY not set, activating dynamic expert stylist engine with realistic streaming.");
            const fallbackAdvice = await aiStyleAdvisor({ genderIdentity, stylePreferences });
            const encoder = new TextEncoder();
            const words = fallbackAdvice.recommendations.split(' ');

            const readableStream = new ReadableStream({
                async start(controller) {
                    let accumulated = '';
                    for (let i = 0; i < words.length; i++) {
                        const token = (i === 0 ? '' : ' ') + words[i];
                        accumulated += token;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ partial: token, accumulated })}\n\n`));
                        await new Promise(r => setTimeout(r, 20));
                    }
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
                model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.6,
                max_tokens: 512,
                stream: true,
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
                        const cleanJson = accumulated.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanJson);
                        parsed.styleImageKey = normalizeStyleKey(parsed.styleImageKey);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: parsed })}\n\n`));
                    } catch (e) {
                        console.error("❌ Failed to parse final generated JSON, using resilient engine:", accumulated);
                        const fallbackAdvice = await aiStyleAdvisor({ genderIdentity, stylePreferences });
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result: fallbackAdvice })}\n\n`));
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
