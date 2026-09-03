
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, PlusCircle, Trash2, Pencil, Users2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';

import { getTeam, updateTeamMember, addTeamMember, toggleTeamMemberAvailability, deleteTeamMember, updateTeamOrder } from '@/app/actions';
import type { TeamMember } from '@/app/actions';
import { useToast } from "@/hooks/use-toast";
import { isValidImageUrl, getSafeImageUrl } from '@/lib/image-validation';
import { ImageUploader } from '@/components/ui/image-uploader';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const newTeamMemberFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Email inválido." }).nullable().optional(),
  role: z.string().min(3, { message: "El rol es requerido." }),
  description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
  imageUrl: z.string().min(1, { message: "Por favor, selecciona o sube una imagen." }),
  isAvailable: z.boolean().default(true),
  whatsapp: z.string().optional().or(z.literal("")),
});

type NewTeamMemberFormData = z.infer<typeof newTeamMemberFormSchema>;
const initialNewTeamMemberFormState = { message: "", errors: {}, success: false };

function AddTeamMemberForm({ onFormSubmit, onOpenChange }: { onFormSubmit: () => void, onOpenChange: (open: boolean) => void }) {
  const [state, formAction] = useActionState(addTeamMember, initialNewTeamMemberFormState);
  const { toast } = useToast();

  const form = useForm<NewTeamMemberFormData>({
    resolver: zodResolver(newTeamMemberFormSchema),
    defaultValues: { name: "", role: "", description: "", imageUrl: "", isAvailable: true, email: "", whatsapp: "" },
  });

  React.useEffect(() => {
    if (state.success) {
      toast({ title: "Éxito", description: state.message });
      onFormSubmit();
      onOpenChange(false);
      form.reset();
    } else if (state.message && !state.success) {
      toast({ title: "Error", description: state.message, variant: "destructive" });
    }
  }, [state, toast, onFormSubmit, onOpenChange, form]);

  return (
    <Form {...form}>
      <form
        action={formAction}
        className="space-y-6"
      >
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem> <FormLabel>Nombre</FormLabel> <FormControl><Input {...field} name="name" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="email" render={({ field: { value, ...field } }) => (<FormItem> <FormLabel>Email (para notificaciones)</FormLabel> <FormControl><Input {...field} value={value ?? ""} name="email" type="email" placeholder="ejemplo@email.com" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="whatsapp" render={({ field: { value, ...field } }) => (<FormItem> <FormLabel>WhatsApp (opcional, ej. 573001234567)</FormLabel> <FormControl><Input {...field} value={value ?? ""} name="whatsapp" type="tel" placeholder="Código de país + número (solo dígitos)" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="role" render={({ field }) => (<FormItem> <FormLabel>Rol</FormLabel> <FormControl><Input {...field} name="role" placeholder="Ej: Barbero, Estilista" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem> <FormLabel>Descripción</FormLabel> <FormControl><Textarea {...field} name="description" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ImageUploader
                  label="Foto del Colaborador"
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <input type="hidden" name="imageUrl" value={field.value} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isAvailable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Disponible para citas</FormLabel>
                <FormDescription>
                  Si está activo, los clientes podrán agendar citas con este colaborador.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  name="isAvailable"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
          <Button type="submit">Añadir Colaborador</Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  email: z.string().email({ message: "Email inválido." }).nullable().optional().or(z.literal("")),
  description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
  imageUrl: z.string().min(1, { message: "Por favor, selecciona o sube una imagen." }),
  isAvailable: z.boolean().default(true),
  role: z.string(),
  whatsapp: z.string().optional().or(z.literal("")),
});

type TeamMemberFormData = z.infer<typeof teamMemberSchema>;
const initialTeamMemberFormState = { message: "", errors: {}, success: false };

function EditTeamMemberForm({ member, onFormSubmit, onOpenChange }: { member: TeamMember, onFormSubmit: () => void, onOpenChange: (open: boolean) => void }) {
  const [state, formAction] = useActionState(updateTeamMember, initialTeamMemberFormState);
  const { toast } = useToast();

  const form = useForm<TeamMemberFormData>({
    resolver: zodResolver(teamMemberSchema),
    defaultValues: { ...member, email: member.email ?? "", whatsapp: member.whatsapp ?? "" },
  });

  React.useEffect(() => {
    if (state.success) {
      toast({ title: "Éxito", description: state.message });
      onFormSubmit();
      onOpenChange(false);
    } else if (state.message && !state.success) {
      toast({ title: "Error", description: state.message || "Por favor, corrige los errores.", variant: "destructive" });
    }
  }, [state, toast, onFormSubmit, onOpenChange]);

  const handleDelete = async () => {
    const { success, message } = await deleteTeamMember(member.id);
    if (success) {
      toast({ title: "Éxito", description: message });
      onFormSubmit();
      onOpenChange(false);
    } else {
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }

  return (
    <Form {...form}>
      <form
        action={formAction}
        className="space-y-6"
      >
        <input type="hidden" name="id" value={form.getValues("id")} />
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem> <FormLabel>Nombre</FormLabel> <FormControl><Input {...field} name="name" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="email" render={({ field: { value, ...field } }) => (<FormItem> <FormLabel>Email (para notificaciones)</FormLabel> <FormControl><Input {...field} value={value ?? ""} name="email" type="email" placeholder="ejemplo@email.com" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="whatsapp" render={({ field: { value, ...field } }) => (<FormItem> <FormLabel>WhatsApp (opcional, ej. 573001234567)</FormLabel> <FormControl><Input {...field} value={value ?? ""} name="whatsapp" type="tel" placeholder="Código de país + número (solo dígitos)" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="role" render={({ field }) => (<FormItem> <FormLabel>Rol</FormLabel> <FormControl><Input {...field} name="role" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem> <FormLabel>Descripción</FormLabel> <FormControl><Textarea {...field} name="description" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <ImageUploader
                  label="Foto del Colaborador"
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <input type="hidden" name="imageUrl" value={field.value} />
              <FormMessage />
            </FormItem>
          )}
        />

        <input type="hidden" name="isAvailable" value={form.getValues("isAvailable").toString()} />

        <DialogFooter className="sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={member.id === 'barba-larga-brand'}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente al colaborador de la base de datos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Sí, eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2">
            <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit">Guardar Cambios</Button>
          </div>
        </DialogFooter>
      </form>
    </Form>
  )
}


export default function TeamPage() {
  const [team, setTeam] = React.useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [openDialogs, setOpenDialogs] = React.useState<Record<string, boolean>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const { toast } = useToast();

  const dragItem = React.useRef<number | null>(null);
  const dragOverItem = React.useRef<number | null>(null);

  const handleSort = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
        dragItem.current = null;
        dragOverItem.current = null;
        return;
    }

    const _team = [...team];
    const draggedItemContent = _team.splice(dragItem.current, 1)[0];
    _team.splice(dragOverItem.current, 0, draggedItemContent);

    dragItem.current = null;
    dragOverItem.current = null;

    setTeam(_team);

    const ordersToSave = _team.map((m, index) => ({ id: m.id, order: index }));
    const result = await updateTeamOrder(ordersToSave);
    if (!result.success) {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
        fetchData();
    } else {
        toast({ title: 'Orden actualizado', description: 'El orden de los barberos se ha guardado correctamente.' });
    }
  };

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const teamData = await getTeam();
      setTeam(teamData);
    } catch (error) {
      console.error("Failed to fetch team:", error);
      toast({ title: "Error", description: "No se pudo cargar el equipo.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    const sessionAuth = sessionStorage.getItem('isAdminAuthenticated');
    const sessionRole = sessionStorage.getItem('userRole');
    if (sessionAuth !== 'true' || sessionRole !== 'admin') {
      window.location.href = '/admin';
      return;
    }
    fetchData();
  }, [fetchData]);

  const handleAvailabilityChange = async (id: string, newAvailability: boolean) => {
    const { success, message } = await toggleTeamMemberAvailability(id, newAvailability);
    if (success) {
      toast({ title: 'Éxito', description: message });
      fetchData(); // Refrescar los datos
    } else {
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const setDialogOpen = (memberId: string, open: boolean) => {
    setOpenDialogs(prev => ({ ...prev, [memberId]: open }));
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
          <h1 className="text-3xl font-bold">Gestionar Equipo</h1>
          <p className="text-muted-foreground">
            Añade, edita o elimina miembros de tu equipo.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Nuevo Colaborador</DialogTitle>
            </DialogHeader>
            <AddTeamMemberForm onFormSubmit={fetchData} onOpenChange={setIsAddDialogOpen} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {team.map((member, index) => (
          <div
            key={member.id}
            draggable
            onDragStart={() => (dragItem.current = index)}
            onDragEnter={() => (dragOverItem.current = index)}
            onDragEnd={handleSort}
            onDragOver={(e) => e.preventDefault()}
            className="cursor-move h-full"
            title="Arrastra para reordenar"
          >
          <Card className="h-full hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="relative h-16 w-16 min-w-[64px]">
                <Image
                  src={getSafeImageUrl(member.imageUrl)}
                  alt={member.name}
                  fill
                  className="rounded-full object-cover"
                  onError={(e) => {
                    // Fallback happens via getSafeImageUrl for initial render, 
                    // but for runtime load errors we can hide it or show placeholder
                    const target = e.target as HTMLImageElement;
                    target.src = "https://i.ibb.co/k2TL19sp/logo-barber.jpg";
                  }}
                />
              </div>
              <div>
                <CardTitle>{member.name}</CardTitle>
                <CardDescription>{member.role}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground min-h-[60px]">{member.description}</p>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor={`availability-${member.id}`} className="flex flex-col space-y-1">
                  <span>Disponible</span>
                  <span className="font-normal leading-snug text-muted-foreground text-xs">
                    Puede ser elegido para citas.
                  </span>
                </Label>
                <Switch
                  id={`availability-${member.id}`}
                  checked={member.isAvailable}
                  onCheckedChange={(checked) => handleAvailabilityChange(member.id, checked)}
                  disabled={member.id === 'barba-larga-brand'}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Dialog open={openDialogs[member.id] || false} onOpenChange={(open) => setDialogOpen(member.id, open)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Colaborador</DialogTitle>
                    </DialogHeader>
                    <EditTeamMemberForm member={member} onFormSubmit={fetchData} onOpenChange={(open) => setDialogOpen(member.id, open)} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
