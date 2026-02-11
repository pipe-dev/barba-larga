'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, PlusCircle, Trash2, Pencil, Bell } from 'lucide-react';

import { getNotifications, addNotification, updateNotification, deleteNotification } from '@/app/actions';
import type { Notification as NotificationType } from '@/app/actions';
import { useToast } from "@/hooks/use-toast";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";

const notificationFormSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(5, { message: "El título debe tener al menos 5 caracteres." }),
    description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
});

type NotificationFormData = z.infer<typeof notificationFormSchema>;
const initialNotificationFormState = { message: "", errors: {}, success: false };

function EditNotificationForm({ notification, onFormSubmit, onOpenChange }: { notification: NotificationType, onFormSubmit: () => void, onOpenChange: (open: boolean) => void }) {
    const [state, formAction] = useActionState(updateNotification, initialNotificationFormState);
    const { toast } = useToast();

    const form = useForm<NotificationFormData>({
        resolver: zodResolver(notificationFormSchema),
        defaultValues: { ...notification },
    });

    React.useEffect(() => {
        if (state.success) {
            toast({ title: "Éxito", description: state.message });
            onFormSubmit();
            onOpenChange(false);
        } else if (state.message && !state.success) {
            toast({ title: "Error", description: state.message, variant: "destructive" });
        }
    }, [state, toast, onFormSubmit, onOpenChange]);

    return (
        <Form {...form}>
            <form
                action={formAction}
                className="space-y-6"
            >
                <input type="hidden" name="id" value={form.getValues("id")} />
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem> <FormLabel>Título</FormLabel> <FormControl><Input {...field} name="title" /></FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem> <FormLabel>Descripción</FormLabel> <FormControl><Textarea {...field} name="description" /></FormControl> <FormMessage /> </FormItem>)} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                    <Button type="submit">Guardar Cambios</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = React.useState<NotificationType[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [openDialogs, setOpenDialogs] = React.useState<Record<string, boolean>>({});
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const { toast } = useToast();

    const [addState, addFormAction] = useActionState(addNotification, initialNotificationFormState);
    const addForm = useForm<NotificationFormData>({
        resolver: zodResolver(notificationFormSchema),
        defaultValues: { title: "", description: "" },
    });
    const addFormRef = React.useRef<HTMLFormElement>(null);

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const notificationsData = await getNotifications();
            setNotifications(notificationsData as NotificationType[]);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
            toast({ title: "Error", description: "No se pudieron cargar las notificaciones.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        const sessionAuth = sessionStorage.getItem('isAdminAuthenticated');
        if (sessionAuth !== 'true') {
            window.location.href = '/admin';
        } else {
            fetchData();
        }
    }, [fetchData]);

    React.useEffect(() => {
        if (addState.success) {
            toast({ title: "Éxito", description: addState.message });
            addForm.reset();
            addFormRef.current?.reset();
            setIsAddDialogOpen(false);
            fetchData();
        } else if (addState.message && !addState.success) {
            toast({ title: "Error", description: addState.message, variant: "destructive" });
        }
    }, [addState, toast, addForm, fetchData]);

    const handleDeleteNotification = async (id: string) => {
        const { success, message } = await deleteNotification(id);
        if (success) {
            toast({ title: "Éxito", description: message });
            fetchData();
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };

    const handleSetDialogOpen = (notificationId: string, open: boolean) => {
        setOpenDialogs(prev => ({ ...prev, [notificationId]: open }));
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <Button variant="ghost" className="mb-2" asChild>
                        <Link href="/admin">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a Citas
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold">Gestionar Notificaciones</h1>
                    <p className="text-muted-foreground">
                        Añade, edita o elimina los anuncios que aparecen en la página de inicio.
                    </p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Notificación
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Añadir Nueva Notificación</DialogTitle>
                            <DialogDescription>
                                Crea un nuevo anuncio para mostrar en la página principal.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...addForm}>
                            <form ref={addFormRef} action={addFormAction} className="space-y-6">
                                <FormField control={addForm.control} name="title" render={({ field }) => (<FormItem> <FormLabel>Título</FormLabel> <FormControl><Input placeholder="Ej: ¡Nuevo Servicio!" {...field} name="title" /></FormControl> <FormMessage /> </FormItem>)} />
                                <FormField control={addForm.control} name="description" render={({ field }) => (<FormItem> <FormLabel>Descripción</FormLabel> <FormControl><Textarea placeholder="Ej: Ahora ofrecemos Keratina..." {...field} name="description" /></FormControl> <FormMessage /> </FormItem>)} />
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                                    <Button type="submit">Añadir Notificación</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Notificaciones Actuales</CardTitle>
                    <CardDescription>Lista de todos los anuncios activos.</CardDescription>
                </CardHeader>
                <CardContent>
                    {notifications.length > 0 ? (
                        <div className="space-y-4">
                            {notifications.map((notif) => (
                                <Card key={notif.id} className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-4">
                                        <Bell className="h-5 w-5 text-primary" />
                                        <div>
                                            <p className="font-semibold">{notif.title}</p>
                                            <p className="text-sm text-muted-foreground">{notif.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <Dialog open={openDialogs[notif.id] || false} onOpenChange={(open) => handleSetDialogOpen(notif.id, open)}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Editar Notificación</DialogTitle>
                                                    <DialogDescription>
                                                        Modifica los detalles del anuncio existente.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <EditNotificationForm
                                                    notification={notif}
                                                    onFormSubmit={fetchData}
                                                    onOpenChange={(open) => handleSetDialogOpen(notif.id, open)}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar esta notificación?</AlertDialogTitle>
                                                    <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteNotification(notif.id)}>Sí, eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
                            <p className="text-muted-foreground">No hay notificaciones.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

