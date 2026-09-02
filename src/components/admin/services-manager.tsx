"use client";

import * as React from "react";
import Image from "next/image";
import { getSafeImageUrl } from "@/lib/image-validation";
import { Service } from "@/lib/data";
import { getServicesFromDB, updateService, createService, deleteService } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import {
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Loader2, Save } from "lucide-react";
import { ImageUploader } from "@/components/ui/image-uploader";

export function ServicesManagerDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
    const [services, setServices] = React.useState<Service[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editingService, setEditingService] = React.useState<Service | null>(null);
    const [isCreating, setIsCreating] = React.useState(false);
    const { toast } = useToast();

    // Form state
    const [price, setPrice] = React.useState("");
    const [duration, setDuration] = React.useState("60");
    const [name, setName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [mediaUrl, setMediaUrl] = React.useState("");
    const [isSaving, setIsSaving] = React.useState(false);
    const [isRestoring, setIsRestoring] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);

    const fetchServices = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const dbServices = await getServicesFromDB();
            if (dbServices && dbServices.length > 0) {
                setServices(dbServices);
            } else {
                setServices([]);
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

    const handleCreateClick = () => {
        setIsCreating(true);
        setEditingService(null);
        setName("");
        setPrice("");
        setDuration("60");
        setDescription("");
        setMediaUrl("");
    };

    const handleEditClick = (service: Service) => {
        setIsCreating(false);
        setEditingService(service);
        setPrice(String(service.price).replace(/\D/g, ''));
        setDuration(service.duration ? service.duration.toString() : "60");
        setName(service.name);
        setDescription(service.description || "");
        setMediaUrl(service.mediaUrl || "");
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ title: "Error", description: "El nombre del servicio es obligatorio.", variant: "destructive" });
            return;
        }
        if (!price || parseInt(price) <= 0) {
            toast({ title: "Error", description: "El precio debe ser mayor a 0.", variant: "destructive" });
            return;
        }
        if (!duration || parseInt(duration) <= 0) {
            toast({ title: "Error", description: "La duración debe ser mayor a 0 minutos.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            if (isCreating) {
                const result = await createService({
                    name: name.trim(),
                    price: price.replace(/\D/g, ''),
                    duration: parseInt(duration),
                    description: description.trim(),
                    mediaUrl: mediaUrl.trim()
                });

                if (result.success) {
                    toast({ title: "Éxito", description: result.message });
                    setIsCreating(false);
                    fetchServices();
                } else {
                    toast({ title: "Error", description: result.message, variant: "destructive" });
                }
            } else if (editingService) {
                const result = await updateService(editingService.id, {
                    price: price.replace(/\D/g, ''),
                    duration: parseInt(duration),
                    name: name.trim(),
                    description: description.trim(),
                    mediaUrl: mediaUrl.trim()
                });

                if (result.success) {
                    toast({ title: "Éxito", description: result.message });
                    setEditingService(null);
                    fetchServices();
                } else {
                    toast({ title: "Error", description: result.message, variant: "destructive" });
                }
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Ocurrió un error al guardar.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (service: Service) => {
        if (!confirm(`¿Estás seguro de eliminar el servicio "${service.name}"?`)) return;
        setDeletingId(service.id);
        try {
            const result = await deleteService(service.id);
            if (result.success) {
                toast({ title: "Eliminado", description: result.message });
                fetchServices();
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo eliminar el servicio.", variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <DialogTitle>Gestionar Servicios</DialogTitle>
                        <DialogDescription>
                            Crea, actualiza los precios, duración y detalles de tus servicios.
                        </DialogDescription>
                    </div>
                    {!editingService && !isCreating && (
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleCreateClick}>
                                <Plus className="h-4 w-4 mr-1" />
                                Agregar Servicio
                            </Button>
                        </div>
                    )}
                </div>
            </DialogHeader>

            {editingService || isCreating ? (
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">
                            {isCreating ? "Nuevo Servicio" : `Editando: ${editingService?.name}`}
                        </h3>
                        <Button variant="ghost" onClick={() => { setEditingService(null); setIsCreating(false); }}>
                            Volver a la lista
                        </Button>
                    </div>
                    <div className="grid gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Servicio *</Label>
                                <Input id="name" placeholder="Ej. Corte Clásico + Barba" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price">Precio ($) *</Label>
                                <Input id="price" type="number" placeholder="Ej. 25000" value={price} onChange={(e) => setPrice(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="duration">Duración (minutos) *</Label>
                                <Input id="duration" type="number" step="5" min="5" placeholder="60" value={duration} onChange={(e) => setDuration(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea id="description" placeholder="Detalles de lo que incluye el servicio..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </div>
                        <div className="space-y-2">
                            <ImageUploader
                                label="Foto del Servicio (selecciona o arrastra tu foto)"
                                value={mediaUrl}
                                onChange={setMediaUrl}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="secondary" onClick={() => { setEditingService(null); setIsCreating(false); }}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            {isCreating ? "Crear Servicio" : "Guardar Cambios"}
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
                        ) : services.length === 0 ? (
                            <div className="text-center py-12 border rounded-lg border-dashed p-6 space-y-4">
                                <p className="text-muted-foreground">No tienes ningún servicio configurado en la base de datos.</p>
                                <div className="flex justify-center gap-3">
                                    <Button onClick={handleCreateClick}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Crear Servicio
                                    </Button>
                                </div>
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
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0 border border-border">
                                                        <Image
                                                            src={getSafeImageUrl(service.mediaUrl)}
                                                            alt={service.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-white truncate">{service.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{service.description}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{service.duration} min</TableCell>
                                            <TableCell>${parseInt(String(service.price).replace(/\D/g, '') || '0').toLocaleString('es-CO')}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleEditClick(service)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(service)}
                                                    disabled={deletingId === service.id}
                                                >
                                                    {deletingId === service.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
