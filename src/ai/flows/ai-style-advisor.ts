
'use server';

/**
 * @fileOverview An AI-powered style advisor for personalized recommendations.
 *
 * - aiStyleAdvisor - A function that provides style advice based on user input.
 * - AIStyleAdvisorInput - The input type for the aiStyleadvisor function.
 * - AIStyleAdvisorOutput - The return type for the aiStyleAdvisor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { services } from '@/lib/data';

const AIStyleAdvisorInputSchema = z.object({
  genderIdentity: z
    .string()
    .describe("The client's gender identity (e.g., male, female, non-binary)."),
  stylePreferences: z
    .string()
    .describe("The client's style preferences and goals."),
});
export type AIStyleAdvisorInput = z.infer<typeof AIStyleAdvisorInputSchema>;

const AIStyleAdvisorOutputSchema = z.object({
  recommendations: z.string().describe('Personalized style recommendations.'),
  suggestedServices: z
    .string()

    .describe('Specific services from the catalog that align with the advice.'),
  suggestedServiceIds: z.array(z.string()).describe('An array of IDs for the suggested services, taken from the catalog.'),
});
export type AIStyleAdvisorOutput = z.infer<typeof AIStyleAdvisorOutputSchema>;

export async function aiStyleAdvisor(input: AIStyleAdvisorInput): Promise<AIStyleAdvisorOutput> {
  return aiStyleAdvisorFlow(input);
}

const promptTemplate = `You are a friendly and encouraging style advisor for Barba Larga, a barbershop. A client will provide their gender identity and style preferences.
  
First, start with a short, positive, and encouraging phrase about their style choices (e.g., "¡Excelente elección!", "¡Buena decisión, ese estilo te quedará genial!").

Then, based on their input and the provided 2025 trends context, provide a **concise but well-advised** personalized style recommendation. The response should be friendly and helpful. You MUST NOT use any markdown formatting (like asterisks for bold or italics). The response should be plain text.

Finally, suggest one or two specific services from our catalog that align with the advice given. You MUST only suggest services from the provided catalog.

IMPORTANT LOGIC:
1.  If the recommendation involves 'color' or 'coloracion', you MUST suggest the 'Coloración Estratégica (Hombre)' service (ID: coloring).
2.  If the recommendation involves 'diseño' or 'estilismo' in the hair, you MUST suggest the 'Corte + Diseño y Cejas' service (ID: haircut-design-eyebrows).
3.  Before suggesting multiple individual services, check if there's a combo package (like 'Experiencia Dominante: Corte y Barba' or 'Servicio Premium') that includes the services you want to recommend. If a package offers better value, suggest the package instead of the individual items. For example, instead of suggesting 'Corte de Autoridad' AND 'Barba: Detalle de Poder', you should suggest 'Experiencia Dominante: Corte y Barba'.

After suggesting the services, you must end your response with the exact phrase: "pregunta a tu asesor humano qué otros productos y servicios tienen para ti en el momento que estés en tu cita"

---
**Contexto de Tendencias de Moda 2025:**

**Filosofía General:** Se busca una combinación de estilos clásicos renovados, texturas naturales y colores que varían entre tonos sutiles y llamativos. Hay un regreso a la naturalidad, pero con un enfoque en el volumen, el movimiento y la personalización.

**Cortes de cabello: Hombre**
- **Degradado natural:** Una versión más suave y orgánica del fade tradicional, perfecta para un look relajado y de bajo mantenimiento.
- **Corte texturizado:** Con laterales más cortos y la parte superior ligeramente más larga, la clave está en el movimiento y una apariencia despeinada y natural.
- **Mullet moderno:** Versión sofisticada con la parte trasera más larga, pero bien definida y estructurada.
- **Faux hawk y mohawk fade:** Estilos atrevidos que expresan individualidad, con la cresta más marcada en el faux hawk y un degradado alto en el mohawk.
- **French crop:** Lados y nuca más cortos y la parte superior texturizada y desordenada.
- **Corte militar con degradado bajo:** Actualización del clásico con un degradado sutil en la parte inferior.

**Cortes de cabello: Mujer**
- **Bobs:** Siguen en tendencia, con versiones desde el "Prada bob" ultracorto hasta el bob clásico a los hombros.
- **Corte mariposa y capas noventeras:** Buscan volumen y movimiento con capas que enmarcan el rostro.
- **Shaggy:** Ideal para un estilo moderno y de bajo mantenimiento, con capas que crean volumen y textura.
- **Flequillos:** Desaliñados, largos y de cortina están de moda, combinándose con cortes en capas.
- **Melena en capas:** Para cabellos de longitud media y larga, para aportar versatilidad y movimiento.

**Coloraciones: Hombre y Mujer**
- **Mocha mousse:** Tono marrón cálido y versátil, color del año de Pantone para 2025.
- **Tonos cobrizos:** Desde el ginger spice vibrante hasta el copper brown elegante.
- **Contouring de pelo:** Técnica que utiliza la coloración para resaltar u ocultar rasgos faciales.
- **Rubios variados:** Desde el rubio avellana (hazel blond) con reflejos dorados y cenizos, hasta el rubio vainilla (vanilla blond).
- **Tonalidades intensas:** Rojo cereza y burdeos intenso para looks atrevidos.
- **Tonalidades oscuras y ahumadas:** Castaño ahumado y terciopelo oscuro para aportar sofisticación.

**Estilismos y Diseño:**
- **Degradados y rapados:** Transiciones más suaves y naturales.
- **Raya al lado sutil:** Versión moderna y más suave.
- **Microdiseños rapados:** Diseños discretos y personalizados.
- **Peinado con pomada:** Para looks más pulidos.
- **Rizos grandes y elásticos:** Potenciados con productos específicos.
- **Acabado natural y texturizado:** Evitar el exceso de producto y optar por movimiento.

---

**Client Information:**
- Gender Identity: {{{genderIdentity}}}
- Style Preferences: {{{stylePreferences}}}

**Available Service Catalog (Format: ID: Name):**
---
{{{serviceCatalog}}}
---`;

const aiStyleAdvisorFlow = ai.defineFlow(
  {
    name: 'aiStyleAdvisorFlow',
    inputSchema: AIStyleAdvisorInputSchema,
    outputSchema: AIStyleAdvisorOutputSchema,
  },
  async input => {
    // Format the service list to be injected into the prompt, including IDs
    const serviceCatalog = services.map(s => `${s.id}: ${s.name}`).join('\n');
    const fullPrompt = promptTemplate
        .replace('{{{genderIdentity}}}', input.genderIdentity)
        .replace('{{{stylePreferences}}}', input.stylePreferences)
        .replace('{{{serviceCatalog}}}', serviceCatalog);
        
    const textOutputSchema = z.object({
        recommendations: z.string().describe('Personalized style recommendations.'),
        suggestedServices: z
          .string()
          .describe('Specific services from the catalog that align with the advice. Respond with only the names of the services.'),
        suggestedServiceIds: z.array(z.string()).describe('An array of one or two IDs for the suggested services, taken from the provided catalog. You MUST return the ID, not the name.'),
      });

    const { output } = await ai.generate({
        model: 'googleai/gemini-flash-latest',
        prompt: fullPrompt,
        output: {
            format: 'json',
            schema: textOutputSchema,
        },
    });

    if (!output) {
        throw new Error("Unable to get a response from the style advisor.");
    }
    
    return output;
  }
);
