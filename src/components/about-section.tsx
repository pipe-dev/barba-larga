
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

export function AboutSection() {
    return (
        <section id="about" className="py-12 md:py-24 bg-card">
            <div className="container max-w-7xl mx-auto grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
                <div className="md:order-2">
                    <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">Sobre Nosotros</h2>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Tu estilo es nuestra misión. Creamos looks que definen quién eres con precisión y arte.
                    </p>
                    <p className="mt-4 text-muted-foreground">
                        Nos enorgullece ofrecer un servicio personalizado y detallado. Desde el corte y afeitado hasta el uso de productos de primera, nos enfocamos en realzar la textura de la barba y el estilo del cabello para lograr un aspecto saludable e impecable.
                    </p>
                </div>
                <div className="md:order-1">
                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                           <div className="relative aspect-square">
                                <Image
                                src="/multimedia/sobre-nosotros.jpg"
                                alt="Un barbero recortando cuidadosamente la barba de un cliente"
                                width={600}
                                height={600}
                                className="object-cover h-full w-full"
                                data-ai-hint="barber working"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}
