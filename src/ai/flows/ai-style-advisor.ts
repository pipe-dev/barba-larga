
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

function normalizeText(str: string | null | undefined): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export async function generateExpertRuleBasedAdvice(input: AIStyleAdvisorInput): Promise<AIStyleAdvisorOutput> {
  const rawGender = input.genderIdentity || '';
  const rawPrefs = input.stylePreferences || '';
  const gender = normalizeText(rawGender);
  const prefs = normalizeText(rawPrefs);

  const isFemale = gender.includes('femenin') || gender.includes('mujer');

  let styleImageKey = 'degradado-natural';
  let suggestedServices = 'Corte de cabello';
  let suggestedServiceIds = ['haircut'];
  let recommendations = '';

  if (isFemale) {
    if (prefs.includes('corto') || prefs.includes('bob')) {
      styleImageKey = 'bob';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Excelente elección! Para tu estilo recomendamos un corte Bob estilizado con acabado pulido que resalta la estructura de tus facciones. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else if (prefs.includes('color') || prefs.includes('tinte') || prefs.includes('mechas') || prefs.includes('rubio')) {
      styleImageKey = 'coloracion';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Gran visión de estilo! Una técnica de coloración y matizado en capas le dará movimiento y vitalidad a tu cabello. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else {
      styleImageKey = 'shaggy';
      suggestedServices = 'Corte de cabello, Cejas con cuchilla';
      suggestedServiceIds = ['haircut', 'eyebrows'];
      recommendations = '¡Te verás espectacular! Te sugerimos un corte Shaggy con textura y capas fluidas que aporta frescura y versatilidad diaria. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    }
    return { recommendations, suggestedServices, suggestedServiceIds, styleImageKey };
  }

  // --- ANÁLISIS DE INTENCIÓN MASCULINA PARA BARBERÍA ---
  const hasMilitary = /(rap|militar|buzz|pelon|pelado|calvo|al cero|sin pelo|quitar.*pelo|sin peinar|bien corto|muy corto)/.test(prefs);
  const hasDesign = /(disen|linea|raya|dibuj|tattoo|greca|figura|grabado)/.test(prefs);
  const hasClassic = /(clasic|formal|oficin|raya|elegant|pompadour|ejecutiv|caballer|slick|peinado.*lado|peinado.*atras|tradicional)/.test(prefs);
  const hasCrop = /(crop|french|flequill|cerquill|cesar|caesar)/.test(prefs);
  const hasMullet = /(mullet|ochenter|largo.*atras|volumen.*atras|cresta.*atras)/.test(prefs);
  const hasFauxHawk = /(faux|hawk|crest|mohawk|puntiagud|puntas)/.test(prefs);
  const hasWavy = /(ondulad|rizad|cresp|chin|rulo|onda|afro)/.test(prefs);
  const hasColor = /(platin|tint|color|mecha|decolor|ceniz|blanc|rubi|rayit)/.test(prefs);
  const hasBeard = /(barb|bigot|candado|chivera|afeitad)/.test(prefs);
  const hasEyebrows = /(cej)/.test(prefs);
  const hasFacial = /(mascarill|facial|exfolia|punt.*negr|limpiez|cutis|piel|gras)/.test(prefs);
  const hasFade = /(fade|degradad|desvanecid|taper|sombr)/.test(prefs);
  const hasShort = /(corto|bajito|fresco|rebaj)/.test(prefs);

  if (hasMilitary) {
    styleImageKey = 'corte-militar';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Máxima frescura, comodidad y disciplina! El corte militar o rapado a piel (buzz cut) es la mejor elección para un look limpio, fresco y varonil que acentúa la mandíbula y no requiere peinado diario. Tip de barbero: Aplica protector solar o tónico hidratante para cuidar el cuero cabelludo tras el corte. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasDesign) {
    styleImageKey = 'diseno-rapado';
    suggestedServices = 'Corte de cabello con diseño';
    suggestedServiceIds = ['haircut-design'];
    recommendations = '¡Gran visión artística y audaz! Para tu estilo recomendamos un degradado medio pulido a navaja que sirva de lienzo para trazar líneas geométricas o diseño libre personalizado con total nitidez. Tip de barbero: Retoca las líneas cada 10-15 días para mantener los bordes impecables. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasClassic) {
    styleImageKey = 'bob'; // Mapped to Pompadour / Classic Gentleman
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Elegancia, presencia y porte profesional! Para un estilo ejecutivo o formal te recomendamos un corte clásico caballero con raya marcada y laterales en degradado cónico suave. Tip de barbero: Péinalo hacia atrás o de lado con pomada base agua de acabado natural. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasMullet) {
    styleImageKey = 'mullet-moderno';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Actitud urbana y vanguardia total! El Mullet moderno 2025 combina laterales muy desvanecidos con capas texturizadas en la parte posterior para un contraste masculino impactante. Tip de barbero: Emplea polvo texturizador en la coronilla para dar volumen sin dejar residuos. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasCrop) {
    styleImageKey = 'french-crop';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Tendencia urbana por excelencia! El French Crop destaca por su flequillo recto o despuntado y textura superior que enmarca la frente, conectado con un fade medio impecable. Tip de barbero: Aplica cera mate arcilla para fijar los mechones con movimiento natural. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasFauxHawk) {
    styleImageKey = 'faux-hawk';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Dinamismo y carácter marcado! El Faux Hawk estiliza el rostro concentrando el volumen en la zona superior y la cresta, complementado con un taper fade o burst fade limpio a los costados. Tip de barbero: Péinalo hacia el centro con fijador mate flexible. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasWavy) {
    styleImageKey = 'shaggy'; // Mapped to Wavy Texturized for Men
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Aprovecha al máximo tus ondas naturales! Te recomendamos mantener longitud superior desfilada a tijera para que el rizo tenga caída y control, acompañado de un degradado limpio en patillas y nuca. Tip de barbero: Aplica crema de peinar hidratante sobre cabello húmedo para evitar el frizz. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasColor) {
    styleImageKey = 'coloracion';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Look vanguardista de alto impacto! La coloración o matizado platinado/cenizo combinada con un fade bajo o medio crea un contraste contemporáneo y de gran estilo. Tip de barbero: Usa champú matizador violeta una vez por semana para mantener el tono frío. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasBeard && hasFacial) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Corte de cabello con Barba, Corte de cabello más mascarilla de exfoliación';
    suggestedServiceIds = ['haircut-beard', 'haircut-facial-mask'];
    recommendations = '¡La experiencia de renovación masculina definitiva! Conectaremos un desvanecido a piel con el perfilado de tu barba a navaja caliente, acompañado de una mascarilla exfoliante para purificar los poros y revitalizar el rostro. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasBeard && hasEyebrows) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Barba combo, Cejas con cuchilla';
    suggestedServiceIds = ['beard-combo', 'eyebrows'];
    recommendations = '¡Presencia, simetría y máxima autoridad! Sincronizaremos el degradado del cabello con el desvanecido de tu barba, complementado con un delineado de cejas a cuchilla para una mirada limpia y definida. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasBeard) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Corte de cabello con Barba';
    suggestedServiceIds = ['haircut-beard'];
    recommendations = '¡Sincronización milimétrica y elegancia! Te sugerimos un degradado natural (skin fade) que conecte suavemente con las líneas de tu barba perfilada a navaja tradicional. Tip de barbero: Aplica unas gotas de aceite nutritivo para barba tras el corte. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasFacial) {
    styleImageKey = 'degradado-natural';
    suggestedServices = 'Corte de cabello más mascarilla de exfoliación';
    suggestedServiceIds = ['haircut-facial-mask'];
    recommendations = '¡Cuidado integral y piel renovada! Un corte degradado moderno acompañado de una mascarilla negra exfoliante para remover impurezas, puntos negros y dejar la piel fresca y descansada. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasEyebrows) {
    styleImageKey = 'french-crop';
    suggestedServices = 'Corte de cabello con ceja';
    suggestedServiceIds = ['haircut-eyebrows'];
    recommendations = '¡Detalle y definición al máximo! Un corte moderno con fade limpio y perfilado de cejas a cuchilla resaltará tus rasgos de forma sutil, varonil y pulcra. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else {
    // Default adaptativo: si el texto pide algo corto o fade, o texturizado
    if (prefs.includes('fade') || prefs.includes('degradad') || prefs.includes('desvanecid')) {
      styleImageKey = 'degradado-natural';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡El clásico moderno infalible! Te recomendamos un degradado natural (fade medio o bajo) pulido a navaja en patillas y nuca, dejando la parte superior con caída y movimiento adaptado a tu cráneo. Tip de barbero: Péinalo con los dedos y un toque de cera mate. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else {
      styleImageKey = 'texturizado';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Versatilidad y estilo contemporáneo! Te sugerimos un corte texturizado a tijera en la zona superior con laterales desvanecidos a máquina, ideal para lucir impecable y peinarte en menos de dos minutos. Tip de barbero: Usa pasta moldeadora mate para un acabado natural sin rigidez. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    }
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
