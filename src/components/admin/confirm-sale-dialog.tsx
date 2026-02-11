'use client';

import React from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Appointment, TeamMember } from '@/app/actions';
import { confirmAppointmentAsSale, deleteAppointment } from '@/app/actions';
import { getServiceDetails } from '@/lib/data';
import { useToast } from "@/hooks/use-toast";

interface ConfirmSaleDialogProps {
    appointment: Appointment;
    team: TeamMember[];
    onSaleConfirmed: () => void;
    onAppointmentDeleted: () => void;
    onOpenChange: (open: boolean) => void;
}

export function ConfirmSaleDialog({ appointment, team, onSaleConfirmed, onAppointmentDeleted, onOpenChange }: ConfirmSaleDialogProps) {
    const [paymentMethod, setPaymentMethod] = React.useState<'cash' | 'card' | 'transfer'>('cash');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    if (!appointment) return null;

    // Find barber
    const barber = team.find(b => b.id === appointment.barberId);
    const barberName = barber ? barber.name : 'Desconocido';

    const { names: serviceNames, totalPrice } = getServiceDetails(appointment.service);

    const handleConfirmSale = async () => {
        setIsSubmitting(true);
        const { success, message } = await confirmAppointmentAsSale(appointment.id, paymentMethod);
        if (success) {
            toast({ title: "Éxito", description: message });
            onSaleConfirmed();
            onOpenChange(false);
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        const { success, message } = await deleteAppointment(appointment.id);
        if (success) {
            toast({ title: "Éxito", description: message });
            onAppointmentDeleted();
            onOpenChange(false);
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirmar Venta de la Cita</DialogTitle>
                <DialogDescription>
                    Esto registrará la venta en el sistema de caja y marcará la cita como completada.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div>
                    <p className="font-medium">{appointment.name}</p>
                    <p className="text-sm font-semibold text-primary/80" data-testid="barber-name">💈 {barberName}</p>
                    <p className="text-sm text-muted-foreground">{serviceNames}</p>
                </div>
                <div className="bg-muted p-3 rounded-md text-center">
                    <p className="text-sm text-muted-foreground">Total a Pagar</p>
                    <p className="text-2xl font-bold text-primary">${totalPrice.toLocaleString('es-CO')}</p>
                </div>
                <Select onValueChange={(value: 'cash' | 'card' | 'transfer') => setPaymentMethod(value)} defaultValue={paymentMethod}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="card">Tarjeta</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter className="sm:justify-between flex-col-reverse sm:flex-row gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar Cita
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción cancelará la cita permanentemente. No se puede deshacer.
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
                    <Button onClick={handleConfirmSale} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Confirmar Venta
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
    );
}
