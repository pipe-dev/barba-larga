
'use server';

/**
 * @fileOverview AI-powered style advisor — uses Groq API (free tier).
 * Model: qwen/qwen3.8-27b or groq/compound-mini.
 * 10 distinct male hairstyle variants in 2025/2026 trends.
 */

import { z } from 'zod';
import { getServicesFromDB } from '@/app/actions/services';
import { normalizeStyleKey, type StyleImageKey } from '@/lib/style-images';

const AIStyleAdvisorInputSchema = z.object({
  genderIdentity: z.string().describe("Client's gender identity."),
  stylePreferences: z.string().describe("Client's style preferences."),
});
export type AIStyleAdvisorInput = z.infer<typeof AIStyleAdvisorInputSchema>;

const AIStyleAdvisorOutputSchema = z.object({
  recommendations: z.string().describe('Personalized style recommendations in plain text (no markdown).'),
  suggestedServices: z.string().describe('Names of suggested services from the catalog.'),
  suggestedServiceIds: z.array(z.string()).describe('IDs of suggested services from the catalog.'),
  styleImageKey: z.string().describe('One of the 10 trending style keys: capas-largo, buzz-cut-militar, french-crop, mullet-moderno, pompadour-clasico, taper-fade-barba, skin-fade-clasico, faux-hawk, ondulado-taper, diseno-rayas'),
});
export type AIStyleAdvisorOutput = z.infer<typeof AIStyleAdvisorOutputSchema>;

// Condensed system prompt for ultra-fast, high-precision Groq responses
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

  let styleImageKey: StyleImageKey = 'skin-fade-clasico';
  let suggestedServices = 'Corte de cabello';
  let suggestedServiceIds = ['haircut'];
  let recommendations = '';

  if (isFemale) {
    if (prefs.includes('corto') || prefs.includes('bob')) {
      styleImageKey = 'pompadour-clasico';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Excelente elección! Para tu estilo recomendamos un corte estilizado con acabado pulido que resalta la estructura de tus facciones. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else if (prefs.includes('color') || prefs.includes('tinte') || prefs.includes('mechas') || prefs.includes('rubio')) {
      styleImageKey = 'capas-largo';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Gran visión de estilo! Una técnica de coloración y matizado en capas le dará movimiento y vitalidad a tu cabello. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else {
      styleImageKey = 'ondulado-taper';
      suggestedServices = 'Corte de cabello, Cejas con cuchilla';
      suggestedServiceIds = ['haircut', 'eyebrows'];
      recommendations = '¡Te verás espectacular! Te sugerimos un corte con textura y capas fluidas que aporta frescura y versatilidad diaria. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    }
    return { recommendations, suggestedServices, suggestedServiceIds, styleImageKey };
  }

  // --- ANÁLISIS DE INTENCIÓN MASCULINA PARA LAS 10 VARIANTES ---
  const hasLongHair = /(capa|largo|melen|hombro|chong|man bun|dejando crecer|atado|coleta)/.test(prefs);
  const hasMilitary = /(rap|militar|buzz|pelon|pelado|calvo|al cero|sin pelo|quitar.*pelo|sin peinar|bien corto|muy corto|rapad)/.test(prefs);
  const hasDesign = /(disen|linea|raya|dibuj|tattoo|greca|figura|grabado|tatuaj)/.test(prefs);
  const hasMullet = /(mullet|ochenter|largo.*atras|volumen.*atras|cresta.*atras|desmechad)/.test(prefs);
  const hasCrop = /(crop|french|flequill|cerquill|cesar|caesar)/.test(prefs);
  const hasClassic = /(clasic|formal|oficin|raya|elegant|pompadour|ejecutiv|caballer|slick|peinado.*lado|peinado.*atras|tradicional)/.test(prefs);
  const hasFauxHawk = /(faux|hawk|crest|mohawk|puntiagud|puntas|levantad)/.test(prefs);
  const hasWavy = /(ondulad|rizad|cresp|chin|rulo|onda|afro|esponjos)/.test(prefs);
  const hasBeard = /(barb|bigot|candado|chivera|afeitad)/.test(prefs);
  const hasEyebrows = /(cej)/.test(prefs);
  const hasFacial = /(mascarill|facial|exfolia|punt.*negr|limpiez|cutis|piel|gras)/.test(prefs);
  const hasFade = /(fade|degradad|desvanecid|taper|sombr|cero|skin)/.test(prefs);

  if (hasLongHair) {
    styleImageKey = 'capas-largo';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Estilo con presencia, fluidez y carácter! Para melenas medias y cabello largo masculino recomendamos estructurar capas fluidas con tijera desfilada para retirar peso, dar movimiento y evitar que se esponje en los costados sin sacrificar tu longitud. Tip de barbero: Aplica crema ligera de peinar o leave-in en puntas para mantener hidratación y caída natural. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasMilitary) {
    styleImageKey = 'buzz-cut-militar';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Máxima frescura, comodidad y disciplina! El corte militar o rapado (buzz cut) es la elección por excelencia para un look limpio, varonil y de impacto que acentúa la mandíbula y no requiere peinado diario. Tip de barbero: Aplica tónico hidratante o protector solar en el cuero cabelludo tras el corte. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasDesign) {
    styleImageKey = 'diseno-rayas';
    suggestedServices = 'Corte de cabello con diseño';
    suggestedServiceIds = ['haircut-design'];
    recommendations = '¡Gran visión artística y audaz! Para tu estilo recomendamos un degradado medio pulido a navaja que sirva de lienzo para trazar líneas geométricas, rayas dobles o diseño libre personalizado con total nitidez. Tip de barbero: Retoca las líneas cada 10-15 días para mantener los bordes impecables. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasMullet) {
    styleImageKey = 'mullet-moderno';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Actitud urbana y vanguardia total! El Mullet moderno 2025 combina laterales muy desvanecidos con capas texturizadas en la parte posterior para un contraste masculino impactante. Tip de barbero: Emplea polvo texturizador en la coronilla para dar volumen sin dejar residuos. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasCrop) {
    styleImageKey = 'french-crop';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Tendencia urbana por excelencia! El French Crop destaca por su flequillo despuntado o recto y textura superior que enmarca la frente, conectado con un fade medio impecable. Tip de barbero: Aplica cera mate arcilla para fijar los mechones con movimiento natural. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasFauxHawk) {
    styleImageKey = 'faux-hawk';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Dinamismo y carácter marcado! El Faux Hawk estiliza el rostro concentrando el volumen en la zona superior y la cresta, complementado con un taper fade o burst fade limpio a los costados. Tip de barbero: Péinalo hacia el centro con fijador mate flexible. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasWavy) {
    styleImageKey = 'ondulado-taper';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Aprovecha al máximo tus ondas o rizos naturales! Te recomendamos mantener longitud superior desfilada a tijera para que el rizo tenga caída y control, acompañado de un degradado limpio en patillas y nuca. Tip de barbero: Aplica crema de peinar hidratante sobre cabello húmedo para evitar el frizz. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasClassic) {
    styleImageKey = 'pompadour-clasico';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡Elegancia, presencia y porte profesional! Para un estilo ejecutivo o formal te recomendamos un corte clásico caballero con raya marcada o pompadour con laterales en degradado cónico suave. Tip de barbero: Péinalo hacia atrás o de lado con pomada base agua de acabado natural. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasBeard && hasFacial) {
    styleImageKey = 'taper-fade-barba';
    suggestedServices = 'Corte de cabello con Barba, Corte de cabello más mascarilla de exfoliación';
    suggestedServiceIds = ['haircut-beard', 'haircut-facial-mask'];
    recommendations = '¡La experiencia de renovación masculina definitiva! Conectaremos un desvanecido cónico con el perfilado de tu barba a navaja caliente, acompañado de una mascarilla exfoliante para purificar los poros y revitalizar el rostro. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasBeard && hasEyebrows) {
    styleImageKey = 'taper-fade-barba';
    suggestedServices = 'Barba combo, Cejas con cuchilla';
    suggestedServiceIds = ['beard-combo', 'eyebrows'];
    recommendations = '¡Presencia, simetría y máxima autoridad! Sincronizaremos el degradado de las patillas con el desvanecido de tu barba, complementado con un delineado de cejas a cuchilla para una mirada limpia y definida. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasBeard) {
    styleImageKey = 'taper-fade-barba';
    suggestedServices = 'Corte de cabello con Barba';
    suggestedServiceIds = ['haircut-beard'];
    recommendations = '¡Sincronización milimétrica y elegancia! Te sugerimos un taper fade que conecte suavemente las patillas con las líneas de tu barba perfilada a navaja tradicional. Tip de barbero: Aplica unas gotas de aceite nutritivo para barba tras el corte. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasFacial) {
    styleImageKey = 'skin-fade-clasico';
    suggestedServices = 'Corte de cabello más mascarilla de exfoliación';
    suggestedServiceIds = ['haircut-facial-mask'];
    recommendations = '¡Cuidado integral y piel renovada! Un corte degradado moderno a piel acompañado de una mascarilla negra exfoliante para remover impurezas, puntos negros y dejar la piel fresca y descansada. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasEyebrows) {
    styleImageKey = 'french-crop';
    suggestedServices = 'Corte de cabello con ceja';
    suggestedServiceIds = ['haircut-eyebrows'];
    recommendations = '¡Detalle y definición al máximo! Un corte moderno French Crop con fade limpio y perfilado de cejas a cuchilla resaltará tus rasgos de forma sutil, varonil y pulcra. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else if (hasFade) {
    styleImageKey = 'skin-fade-clasico';
    suggestedServices = 'Corte de cabello';
    suggestedServiceIds = ['haircut'];
    recommendations = '¡El clásico moderno infalible! Te recomendamos un degradado natural (skin fade medio o bajo) pulido a navaja en patillas y nuca, dejando la parte superior con caída y textura adaptada a tu cráneo. Tip de barbero: Péinalo con los dedos y un toque de cera mate. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
  } else {
    // Variación dinámica adaptativa para evitar respuestas idénticas estáticas
    const variantIndex = Math.abs(prefs.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 3;
    if (variantIndex === 0) {
      styleImageKey = 'french-crop';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Versatilidad y estilo contemporáneo urbano! Te sugerimos un French Crop con textura en la parte superior y laterales en degradado medio, ideal para lucir impecable y peinarte en menos de dos minutos. Tip de barbero: Usa pasta moldeadora mate para un acabado natural sin brillo. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else if (variantIndex === 1) {
      styleImageKey = 'pompadour-clasico';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Porte distinguido y presencia ejecutiva! Te recomendamos un peinado clásico con raya suave o pompadour contemporáneo, manteniendo laterales desvanecidos a tijera y máquina para un acabado limpio. Tip de barbero: Aplica pomada base agua para fijación flexible durante todo el día. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
    } else {
      styleImageKey = 'skin-fade-clasico';
      suggestedServices = 'Corte de cabello';
      suggestedServiceIds = ['haircut'];
      recommendations = '¡Contraste nítido y elegancia masculina! Te sugerimos un degradado medio (mid fade) a piel, dejando la zona alta con volumen equilibrado que estiliza la mandíbula y alarga el rostro. Tip de barbero: Un toque de spray de sal marina le dará textura natural sin apelmazar. Pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita.';
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
  const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

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
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.6,
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
            output.styleImageKey = normalizeStyleKey(output.styleImageKey);
            return output;
          }
        }
      } else {
        console.warn(`⚠️ Groq API responded with ${response.status}, trying fallback engine.`);
      }
    } catch (groqError) {
      console.warn("⚠️ Groq AI API error, activating style engine fallback:", groqError);
    }
  }

  // Resilient Fallback: Rule-Based Stylist Engine (Always reliable, 0 errors)
  return generateExpertRuleBasedAdvice(input);
}

