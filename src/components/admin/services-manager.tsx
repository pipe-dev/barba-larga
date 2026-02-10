"use client";

import * as React from "react";
import { useActionState } from "react";
import { Service } from "@/lib/data";
import { getServicesFromDB, updateService } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Loader2, Save } from "lucide-react";
import { services as staticServices } from "@/lib/data";

export function ServicesManagerDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
    const [services, setServices] = React.useState<Service[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editingService, setEditingService] = React.useState<Service | null>(null);
    const { toast } = useToast();

    // Form state for editing
    const [price, setPrice] = React.useState("");
    const [duration, setDuration] = React.useState("");
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);

    const fetchServices = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const dbServices = await getServicesFromDB();
            if (dbServices && dbServices.length > 0) {
                // Merge with static data to ensure all fields are present if DB is partial
                const merged = dbServices.map(dbS => {
                    const staticS = staticServices.find(s => s.id === dbS.id);
                    return {
                        ...dbS,
                        price: dbS.price || staticS?.price || "0",
                        duration: dbS.duration || staticS?.duration || 60,
                        name: dbS.name || staticS?.name || "",
                        description: dbS.description || staticS?.description || "",
                    } as Service;
                });
                setServices(merged);
            } else {
                setServices(staticServices);
            }
        } catch (error) {
            console.error("Failed to fetch services", error);
            toast({ title: "Error", description: "No se pudieron cargar los servicios.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const handleEditClick = (service: Service) => {
        setEditingService(service);
        setPrice(service.price.replace(/\D/g, ''));
        setDuration(service.duration.toString());
        setName(service.name);
        setDescription(service.description);
    };

    const handleSave = async () => {
        if (!editingService) return;
        setIsSaving(true);
        try {
            const result = await updateService(editingService.id, {
                price: price,
                duration: parseInt(duration),
                name: name,
                description: description
            });

            if (result.success) {
                toast({ title: "Éxito", description: "Servicio actualizado correctamente." });
                setEditingService(null);
                fetchServices(); // Refresh list
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Ocurrió un error al guardar.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
                <DialogTitle>Gestionar Servicios</DialogTitle>
                <DialogDescription>
                    Actualiza los precios, duración y detalles de los servicios ofrecidos.
                </DialogDescription>
            </DialogHeader>

            {editingService ? (
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Editando: {editingService.name}</h3>
                        <Button variant="ghost" onClick={() => setEditingService(null)}>Volver a la lista</Button>
                    </div>
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Servicio</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price">Precio ($)</Label>
                                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="duration">Duración (minutos)</Label>
                                <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setEditingService(null)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </div>
            ) : (
                <>
                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Servicio</TableHead>
                                        <TableHead>Duración</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services.map((service) => (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium">
                                                <div>{service.name}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{service.description}</div>
                                            </TableCell>
                                            <TableCell>{service.duration} min</TableCell>
                                            <TableCell>${parseInt(service.price).toLocaleString('es-CO')}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleEditClick(service)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
    );
}
