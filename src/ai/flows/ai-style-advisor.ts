
'use server';

/**
 * @fileOverview AI-powered style advisor — uses Groq API (free tier).
 * Model: llama-3.3-70b-versatile (fast, free, supports JSON mode).
 * Exports the same interface so the client doesn't need changes.
 */

import { z } from 'zod';
import { getServicesFromDB } from '@/app/actions/services';

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
2. Da una recomendación concisa basada en tendencias 2025 y las preferencias del cliente
3. Sugiere 1-2 servicios del catálogo
4. Termina con: "pregunta a tu asesor humano qué otros productos y servicios tienen para ti"

REGLAS CRÍTICAS DE GÉNERO:
- Si el cliente es HOMBRE (o selecciona Masculino): recomienda ÚNICAMENTE cortes masculinos para barbería: degradado-natural, french-crop, texturizado, mullet-moderno, faux-hawk, corte-militar o diseno-rapado. JAMÁS sugieras estilos femeninos para clientes hombres.
- Si el cliente es MUJER (o selecciona Femenino): puedes sugerir bob, shaggy o coloracion.

REGLAS de servicios:
- Si recomiendas corte + barba → sugiere "Corte y Barba" (ID: haircut-beard) o "Corte y Combo Barba" (ID: beard-combo)
- Si recomiendas cejas → sugiere "Corte y Cejas" (ID: haircut-eyebrows) o "Perfilado de Cejas" (ID: eyebrows)
- Si recomiendas diseño → sugiere "Corte y Diseño" (ID: haircut-design)
- Si recomiendas mascarilla / exfoliación → sugiere "Corte y Mascarilla" (ID: haircut-facial-mask)
- Si recomiendas corte estándar → sugiere "Corte Clásico" (ID: haircut)

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

function generateExpertRuleBasedAdvice(input: AIStyleAdvisorInput): AIStyleAdvisorOutput {
  const gender = (input.genderIdentity || '').toLowerCase();
  const prefs = (input.stylePreferences || '').toLowerCase();

  const isFemale = gender.includes('femenin') || gender.includes('mujer') || prefs.includes('mujer');
  const hasBeard = prefs.includes('barba') || prefs.includes('bigote') || prefs.includes('afeitado') || prefs.includes('perfilado de barba');
  const hasEyebrows = prefs.includes('ceja') || prefs.includes('cejas') || prefs.includes('perfilado');
  const hasDesign = prefs.includes('diseño') || prefs.includes('linea') || prefs.includes('dibujo') || prefs.includes('freestyle');
  const hasFacial = prefs.includes('mascarilla') || prefs.includes('facial') || prefs.includes('exfolia') || prefs.includes('piel') || prefs.includes('puntos negros');
  const hasCrop = prefs.includes('crop') || prefs.includes('french') || prefs.includes('textura');
  const hasMullet = prefs.includes('mullet') || prefs.includes('mohawk') || prefs.includes('cresta') || prefs.includes('moderno');
  const hasShort = prefs.includes('corto') || prefs.includes('militar') || prefs.includes('rapado') || prefs.includes('buzz');

  let styleImageKey = 'degradado-natural';
  let suggestedServices = 'Corte Clásico';
  let suggestedServiceIds = ['haircut'];
  let recommendations = '';

  if (isFemale) {
    if (prefs.includes('corto') || prefs.includes('bob')) {
      styleImageKey = 'bob';
      recommendations = '¡Excelente elección! Para tu estilo recomendamos un corte Bob estilizado con acabado pulido que resalta la estructura facial. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
    } else if (prefs.includes('color') || prefs.includes('tinte') || prefs.includes('mechas')) {
      styleImageKey = 'coloracion';
      recommendations = '¡Gran visión de estilo! Una técnica de coloración y matizado en capas le dará movimiento y vitalidad a tu cabello. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
    } else {
      styleImageKey = 'shaggy';
      recommendations = '¡Te verás espectacular! Te sugerimos un corte Shaggy con textura y capas fluidas que aporta frescura y versatilidad diaria. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
    }
    suggestedServices = 'Corte Clásico, Perfilado de Cejas';
    suggestedServiceIds = ['haircut', 'eyebrows'];
  } else if (hasFacial) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Corte y Mascarilla';
    suggestedServiceIds = ['haircut-facial-mask'];
    recommendations = '¡Excelente decisión de autocuidado! Te recomendamos un fade limpio complementado con una mascarilla exfoliante profunda para revitalizar la piel y lucir impecable. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasDesign) {
    styleImageKey = 'diseno-rapado';
    suggestedServices = 'Corte y Diseño';
    suggestedServiceIds = ['haircut-design'];
    recommendations = '¡Un estilo audaz y con personalidad! Te recomendamos un degradado medio o alto con líneas de diseño personalizadas que marquen tu identidad. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasBeard && hasEyebrows) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Corte y Combo Barba, Perfilado de Cejas';
    suggestedServiceIds = ['beard-combo', 'eyebrows'];
    recommendations = '¡El paquete de máxima presencia! Un fade sincronizado con el degradado de tu barba y un perfilado de cejas profesional para enmarcar tu mirada con total autoridad. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasBeard) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Corte y Barba';
    suggestedServiceIds = ['haircut-beard'];
    recommendations = '¡Transformación total y elegancia! Te sugerimos un degradado suave que conecte a la perfección con la barba perfilada a navaja. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasEyebrows) {
    styleImageKey = 'french-crop';
    suggestedServices = 'Corte y Cejas';
    suggestedServiceIds = ['haircut-eyebrows'];
    recommendations = '¡Un look fresco y pulido! Un corte moderno con perfilado de cejas preciso resaltará tus rasgos de forma sutil y elegante. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasCrop) {
    styleImageKey = 'french-crop';
    suggestedServices = 'Corte Clásico';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Tendencia urbana de primera! El French Crop con textura superior y fade bajo o medio es perfecto para un peinado fácil y moderno. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasMullet) {
    styleImageKey = 'mullet-moderno';
    suggestedServices = 'Corte Clásico';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Estilo vanguardista y con mucha actitud! Un Mullet moderno con laterales desvanecidos y volumen posterior te dará un perfil único. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else if (hasShort) {
    styleImageKey = 'corte-militar';
    suggestedServices = 'Corte Clásico';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Comodidad, frescura y disciplina! Un corte militar o buzz cut con degradado a piel (skin fade) que resalta la mandíbula. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  } else {
    styleImageKey = 'texturizado';
    suggestedServices = 'Corte Clásico';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Gran elección de estilo! Te recomendamos un corte con acabado texturizado arriba y desvanecido limpio a los lados para lucir impecable en cualquier ocasión. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti.';
  }

  return {
    recommendations,
    suggestedServices,
    suggestedServiceIds,
    styleImageKey,
  };
}

export async function aiStyleAdvisor(input: AIStyleAdvisorInput): Promise<AIStyleAdvisorOutput> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (GROQ_API_KEY) {
    const dbServices = await getServicesFromDB();
    const serviceCatalog = dbServices.map(s => `${s.id}: ${s.name}`).join('\n');
    const userMessage = `Cliente: ${input.genderIdentity}\nPreferencias: ${input.stylePreferences}\n\nCatálogo:\n${serviceCatalog}`;

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

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const validated = AIStyleAdvisorOutputSchema.safeParse(parsed);
          if (validated.success) {
            const output = validated.data;
            const isFemale = (input.genderIdentity || '').toLowerCase().includes('femenin') || (input.genderIdentity || '').toLowerCase().includes('mujer');
            if (!isFemale && (output.styleImageKey === 'bob' || output.styleImageKey === 'shaggy')) {
              output.styleImageKey = 'degradado-natural';
            }
            return output;
          }
        }
      }
    } catch (groqError) {
      console.warn("⚠️ Groq AI API unavailable, activating style engine fallback.");
    }
  }

  // Resilient Fallback: Rule-Based Stylist Engine (Always reliable, 0 errors)
  return generateExpertRuleBasedAdvice(input);
}
