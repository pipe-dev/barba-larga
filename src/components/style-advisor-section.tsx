
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Bot, Loader2, Instagram, Facebook, Play, Pause } from "lucide-react";

import type { AIStyleAdvisorOutput } from "@/ai/flows/ai-style-advisor";
import { aiStyleAdvisor } from "@/ai/flows/ai-style-advisor";
import { useBooking } from "@/hooks/use-booking";
import { services } from "@/lib/data";
import { getStyleImage } from "@/lib/style-images";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";

const formSchema = z.object({
  genderIdentity: z.string({ required_error: "Por favor, selecciona una opción." }),
  stylePreferences: z.string().min(10, { message: "Describe un poco más tu estilo (mín. 10 caracteres)." }),
});

type FormData = z.infer<typeof formSchema>;
type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';


const loadingPhrases = [
  "Analizando tu estilo...",
  "Consultando con nuestros expertos en moda...",
  "Buscando la combinación perfecta para ti...",
  "Creando tu recomendación personalizada...",
  "Afinando los últimos detalles...",
];

export function StyleAdvisorSection({ onNavigate }: { onNavigate: (scene: Scene) => void }) {
  const [recommendation, setRecommendation] = React.useState<AIStyleAdvisorOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = React.useState(0);

  const { setSelectedServices } = useBooking();
  const { toast } = useToast();
  const { speak, cancel, isSpeaking } = useTextToSpeech();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      genderIdentity: "",
      stylePreferences: "",
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setIsStreaming(false);
    setStreamingText('');
    setRecommendation(null);
    setError(null);
    cancel();

    try {
      // Try streaming endpoint first
      const res = await fetch('/api/style-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok || !res.body) throw new Error('Streaming failed');

      setIsLoading(false);
      setIsStreaming(true);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const payload = JSON.parse(line.slice(6));

            if (payload.accumulated) {
              setStreamingText(payload.accumulated);
            }

            if (payload.done && payload.result) {
              setRecommendation(payload.result);
              setIsStreaming(false);
              if (payload.result.recommendations) {
                speak(`${payload.result.recommendations}. ${payload.result.suggestedServices}.`);
              }
            } else if (payload.done && payload.error) {
              throw new Error(payload.error);
            }
          } catch (parseErr) {
            // Skip malformed chunks
          }
        }
      }
    } catch (e) {
      console.warn('Streaming failed, falling back to server action:', e);
      // Fallback to server action
      try {
        const result = await aiStyleAdvisor(data);
        setRecommendation(result);
        if (result.recommendations) {
          speak(`${result.recommendations}. ${result.suggestedServices}.`);
        }
      } catch (e2) {
        console.error(e2);
        setError('Ha ocurrido un error al obtener la recomendación. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleBookRecommended = () => {
    if (recommendation?.suggestedServiceIds) {
      setSelectedServices(recommendation.suggestedServiceIds);
      toast({
        title: "✅ Servicios Seleccionados",
        description: "Ahora elige tu barbero favorito para continuar con la reserva.",
      });
      onNavigate('team');
    }
  };

  const handleToggleAudio = () => {
    if (isSpeaking) {
      cancel();
    } else if (recommendation) {
      speak(`${recommendation.recommendations}. ${recommendation.suggestedServices}.`);
    }
  }

  React.useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingPhraseIndex((prevIndex) => (prevIndex + 1) % loadingPhrases.length);
      }, 2000); // Change phrase every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  const recommendedServices = React.useMemo(() => {
    if (!recommendation?.suggestedServiceIds) return [];
    return recommendation.suggestedServiceIds
      .map(id => services.find(s => s.id === id))
      .filter((s): s is (typeof services)[0] => !!s);
  }, [recommendation]);

  const styleImage = React.useMemo(() => {
    if (!recommendation?.styleImageKey) return null;
    return getStyleImage(recommendation.styleImageKey);
  }, [recommendation]);


  return (
    <section id="ai-advisor" className="pt-0 pb-12 md:pb-24">
      <div className="grid gap-10 md:grid-cols-2">
        <div>

          <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">Asesor de Estilo IA</h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            ¿No estás seguro de qué estilo te queda mejor? Nuestro asistente de inteligencia artificial te ayudará a encontrar el look perfecto para ti.
          </p>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Encuentra tu Estilo</CardTitle>
              <CardDescription>Completa el formulario para recibir tu recomendación personalizada.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="genderIdentity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>¿Con qué género te identificas?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una opción" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="femenino">Femenino</SelectItem>
                            <SelectItem value="no-binario">No binario</SelectItem>
                            <SelectItem value="otro">Otro / Prefiero describirlo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stylePreferences"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferencias de Estilo</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ej: 'Busco un look profesional pero moderno', 'Quiero algo atrevido', etc."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isLoading || isStreaming} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isLoading ? "Conectando con la IA..." : isStreaming ? "Recibiendo respuesta..." : "Obtener Recomendación"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-center">
          {isLoading && (
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground transition-opacity duration-500">{loadingPhrases[loadingPhraseIndex]}</p>
            </div>
          )}
          {isStreaming && streamingText && (
            <Card className="w-full bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-6 w-6 text-primary animate-pulse" />
                  Generando recomendación...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{streamingText}<span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" /></p>
              </CardContent>
            </Card>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {recommendation ? (
            <Card className="w-full bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-primary" />
                    Tu Recomendación
                  </div>
                  <Button variant="outline" size="icon" onClick={handleToggleAudio} aria-label={isSpeaking ? 'Detener' : 'Escuchar'}>
                    {isSpeaking ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {styleImage && (
                  <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-4 border border-border/50">
                    <Image
                      src={styleImage.path}
                      alt={styleImage.label}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white text-sm font-semibold">📸 Referencia: {styleImage.label}</p>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold">Recomendaciones de Estilo:</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{recommendation.recommendations}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Servicios Sugeridos:</h4>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {recommendedServices.map(service => (
                      <li key={service.id}>{service.name}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-start gap-4">
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  {recommendedServices.length > 0 && (
                    <Button variant="3d" onClick={handleBookRecommended} className="flex-1">
                      Reservar Servicios Sugeridos
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ) : !isLoading && (
            <div className="text-center p-8 border-2 border-dashed rounded-lg">
              <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Tu recomendación aparecerá aquí.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
