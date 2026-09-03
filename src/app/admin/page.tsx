

'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { getNotifications, getAllAppointments, verifyAdminPassword, logoutAdmin, checkAdminSession, deleteAppointment, confirmAppointmentAsSale, getTeam, reactivateAppointment, bookAppointment, deleteBlockedSlot, deleteAllBlockedSlots, blockTimeSlot, getAvailableTimesForDate, addNotification, updateNotification, deleteNotification } from '@/app/actions';
import type { Appointment, TeamMember, Notification as NotificationType } from '@/app/actions';
import { Service, getBaseAvailableTimes, getEndTimeOptions, getServiceDetails, timeToMinutes, minutesToTimeStr, doIntervalsOverlap, getServiceDuration } from '@/lib/data';
import { getServicesFromDB } from '@/app/actions/services';
import { format, parseISO, parse } from 'date-fns';
import { es } from 'date-fns/locale';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";


import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, LogOut, User, Scissors, CheckCircle, MoreVertical, RefreshCw, Lock, Calendar as CalendarIcon, DollarSign, History, ArrowLeft, PlusCircle, Trash2, Download, Pencil, Briefcase, Users2, Bell, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { InstallPwaButton } from '@/components/install-pwa-button';
import { AppointmentCalendar } from '@/components/admin/appointment-calendar';
import { ConfirmSaleDialog } from '@/components/admin/confirm-sale-dialog';
import { ServicesManagerDialog } from '@/components/admin/services-manager';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { MultiSelect } from '@/components/ui/multi-select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from '@/components/ui/textarea';


function downloadCSV(data: any[], filename: string) {
    if (!data || data.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }
    const headers = Object.keys(data[0]);
    // Capitalize and replace underscores for better readability
    const formattedHeaders = headers.map(header =>
        header.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    );

    const csvContent = [
        formattedHeaders.join(','),
        ...data.map(row => headers.map(header => {
            let cell = row[header];

            if (cell === null || cell === undefined) {
                return '';
            }
            if (cell instanceof Date) {
                return format(cell, "yyyy-MM-dd HH:mm:ss");
            }

            let stringCell = String(cell);
            // Escape quotes by doubling them, and wrap if it contains comma, newline or quote
            if (stringCell.includes('"') || stringCell.includes(',') || stringCell.includes('\n')) {
                stringCell = `"${stringCell.replace(/"/g, '""')}"`;
            }
            return stringCell;
        }).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}



function AdminLoginPage({ onLoginSuccess }: { onLoginSuccess: (role: 'admin' | 'barber') => void }) {
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { success, role } = await verifyAdminPassword(password);

        if (success && role) {
            sessionStorage.setItem('isAdminAuthenticated', 'true');
            sessionStorage.setItem('userRole', role);
            onLoginSuccess(role);
        } else {
            setError('Contraseña incorrecta.');
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Acceso de Administrador</CardTitle>
                    <CardDescription>
                        Ingresa la contraseña para ver las citas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Entrar
                        </Button>
                        <Button variant="link" className="w-full" asChild>
                            <Link href="/">Volver a la página principal</Link>
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}



type SlotSelectionInfo = {
    start: Date;
    end: Date;
    barberId?: string;
};

function BlockTimeDialog({ team, onDataChange, onOpenChange, initialData }: { team: TeamMember[], onDataChange: () => void, onOpenChange: (open: boolean) => void, initialData?: SlotSelectionInfo }) {
    const [state, formAction] = useActionState(blockTimeSlot, { success: false, message: "", errors: {} });
    const { toast } = useToast();
    const formRef = React.useRef<HTMLFormElement>(null);

    const [barberId, setBarberId] = React.useState(initialData?.barberId || "");
    const [date, setDate] = React.useState<Date | undefined>(initialData?.start ? new Date(initialData.start) : new Date());
    const [time, setTime] = React.useState(initialData?.start ? format(new Date(initialData.start), "hh:mm a") : "");
    const [endTime, setEndTime] = React.useState(initialData?.end ? format(new Date(initialData.end), "hh:mm a") : "");
    const [name, setName] = React.useState("Descanso");
    const [recurrence, setRecurrence] = React.useState("none");

    const watchDate = date || new Date();

    const timeOptions = React.useMemo(() => {
        const allDayTimes: string[] = [];
        const baseTimes = getBaseAvailableTimes(watchDate);
        allDayTimes.push(...baseTimes.morning, ...baseTimes.afternoon, ...baseTimes.night);
        return allDayTimes;
    }, [watchDate]);

    const endTimeOptions = React.useMemo(() => {
        return getEndTimeOptions(watchDate);
    }, [watchDate]);

    React.useEffect(() => {
        if (state.success) {
            toast({ title: "Éxito", description: state.message });
            onDataChange();
            onOpenChange(false);
        } else if (state.message && !state.success) {
            toast({ title: "Error", description: state.message || "Por favor, corrige los errores en el formulario.", variant: "destructive" });
        }
    }, [state, toast, onDataChange, onOpenChange]);

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Bloquear Horario</DialogTitle>
                <DialogDescription>
                    Selecciona un intervalo de tiempo para marcarlo como no disponible en el calendario de un colaborador.
                </DialogDescription>
            </DialogHeader>
            <form
                ref={formRef}
                action={formAction}
                className="space-y-4"
            >
                <input type="hidden" name="date" value={date ? format(date, "yyyy-MM-dd") : ""} />
                <input type="hidden" name="barberId" value={barberId} />

                <div className="space-y-2">
                    <Label htmlFor="barberId">Colaborador</Label>
                    <Select onValueChange={setBarberId} value={barberId} name="barberId">
                        <SelectTrigger id="barberId"><SelectValue placeholder="Selecciona un colaborador" /></SelectTrigger>
                        <SelectContent>
                            {team.filter(t => t.isAvailable).map(barber => (
                                <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {state.errors?.barberId && <p className="text-sm text-destructive">{state.errors.barberId[0]}</p>}
                </div>

                <div className="space-y-2 flex flex-col">
                    <Label>Fecha</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !date && "text-muted-foreground")}>
                                {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                        </PopoverContent>
                    </Popover>
                    {state.errors?.date && <p className="text-sm text-destructive">{state.errors.date[0]}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="time">Inicio</Label>
                        <Select onValueChange={setTime} value={time} name="time">
                            <SelectTrigger id="time"><SelectValue placeholder="Inicio" /></SelectTrigger>
                            <SelectContent>{timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        {state.errors?.time && <p className="text-sm text-destructive">{state.errors.time[0]}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="endTime">Fin</Label>
                        <Select onValueChange={setEndTime} value={endTime} name="endTime">
                            <SelectTrigger id="endTime"><SelectValue placeholder="Fin" /></SelectTrigger>
                            <SelectContent>{endTimeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        {state.errors?.endTime && <p className="text-sm text-destructive">{state.errors.endTime[0]}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="recurrence">Repetir bloqueo</Label>
                    <Select onValueChange={setRecurrence} value={recurrence} name="recurrence">
                        <SelectTrigger id="recurrence"><SelectValue placeholder="No repetir" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No repetir</SelectItem>
                            <SelectItem value="weekly">Cada semana este mes</SelectItem>
                            <SelectItem value="daily">Todos los días este mes</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="name">Descripción</Label>
                    <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Almuerzo, Cita médica" />
                    {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
                </div>

                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                    <Button type="submit">
                        <Lock className="mr-2 h-4 w-4" /> Bloquear
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

function ConfirmDeleteAllDialog({ onConfirm, onCancel, barberName }: { onConfirm: () => void, onCancel: () => void, barberName: string }) {
    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar todos los bloqueos de {barberName}?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción eliminará permanentemente TODOS los horarios bloqueados para este barbero. Esta acción no se puede deshacer.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Sí, eliminar todo
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}

function DeleteBlockDialog({ slot, team, onDeleted, onOpenChange }: { slot: Appointment, team: TeamMember[], onDeleted: () => void, onOpenChange: (open: boolean) => void }) {
    const [isConfirmingDeleteAll, setIsConfirmingDeleteAll] = React.useState(false);
    const { toast } = useToast();

    if (!slot) return null;

    const barber = team.find(b => b.id === slot.barberId);

    const handleDelete = async () => {
        const { success, message } = await deleteBlockedSlot(slot.id);
        if (success) {
            toast({ title: "Éxito", description: message });
            onDeleted();
            onOpenChange(false);
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };

    const handleDeleteAll = async () => {
        if (!barber) {
            toast({ title: "Error", description: "No se pudo identificar al barbero para eliminar los bloqueos.", variant: "destructive" });
            return;
        }
        const { success, message } = await deleteAllBlockedSlots(barber.id);
        if (success) {
            toast({ title: "Éxito", description: message });
            onDeleted();
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
        setIsConfirmingDeleteAll(false);
        onOpenChange(false);
    };

    return (
        <AlertDialog open={isConfirmingDeleteAll ? false : undefined}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gestionar Bloqueo de Horario</DialogTitle>
                    <DialogDescription>
                        Has seleccionado el evento &quot;{slot.name}&quot; de {barber?.name} para el día {format(parseISO(slot.date), "PPP", { locale: es })} de {slot.time} a {slot.endTime}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button variant="accent-blue" onClick={handleDelete}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar este bloqueo
                    </Button>
                    <Button variant="destructive" onClick={() => setIsConfirmingDeleteAll(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar todos los bloqueos
                    </Button>
                </DialogFooter>
                {isConfirmingDeleteAll && barber && (
                    <AlertDialog open={isConfirmingDeleteAll} onOpenChange={setIsConfirmingDeleteAll}>
                        <ConfirmDeleteAllDialog
                            barberName={barber.name}
                            onConfirm={handleDeleteAll}
                            onCancel={() => setIsConfirmingDeleteAll(false)}
                        />
                    </AlertDialog>
                )}
            </DialogContent>
        </AlertDialog>
    );
}

function AddAppointmentDialog({ team, onDataChange, onOpenChange, initialData }: { team: TeamMember[], onDataChange: () => void, onOpenChange: (open: boolean) => void, initialData?: SlotSelectionInfo }) {
    const [state, formAction] = useActionState(bookAppointment, { success: false, message: "", errors: {} });
    const { toast } = useToast();

    // Form state
    const [barberId, setBarberId] = React.useState(initialData?.barberId || "");
    const [serviceIds, setServiceIds] = React.useState<string[]>([]);
    const [date, setDate] = React.useState<Date | undefined>(initialData?.start ? new Date(initialData.start) : new Date());
    const [time, setTime] = React.useState(initialData?.start ? format(new Date(initialData.start), "hh:mm a") : "");
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [phone, setPhone] = React.useState("");

    // UI state
    const [bookedTimes, setBookedTimes] = React.useState<string[]>([]);
    const [bookedIntervals, setBookedIntervals] = React.useState<{ startMin: number; endMin: number }[]>([]);
    const [gapSlots, setGapSlots] = React.useState<string[]>([]);
    const [isFetchingTimes, setIsFetchingTimes] = React.useState(false);

    const fetchBookedTimes = React.useCallback((forDate: Date, forBarberId: string) => {
        if (!forDate || !forBarberId) return;
        setIsFetchingTimes(true);
        const dateString = format(forDate, "yyyy-MM-dd");
        getAvailableTimesForDate(dateString, forBarberId)
            .then(result => {
                const formattedTimes = (result.blocked || []).map(t => t.toUpperCase().replace(/\s/g, ''));
                setBookedTimes(formattedTimes);
                setGapSlots(result.gaps || []);
                setBookedIntervals(result.intervals || []);
            })
            .catch(console.error)
            .finally(() => setIsFetchingTimes(false));
    }, []);

    React.useEffect(() => {
        if (date && barberId) {
            fetchBookedTimes(date, barberId);
        }
    }, [date, barberId, fetchBookedTimes]);

    const [services, setServices] = React.useState<Service[]>([]);

    React.useEffect(() => {
        getServicesFromDB().then(res => {
            if (res && res.length > 0) setServices(res);
        }).catch(console.error);
    }, []);

    const { morning, afternoon, night } = React.useMemo(() => {
        if (!date) return { morning: [], afternoon: [], night: [] };
        const baseTimes = getBaseAvailableTimes(date);
        const totalDuration = getServiceDuration(serviceIds.join(','), services);

        const isSlotFit = (startTimeStr: string) => {
            const startMinutes = timeToMinutes(startTimeStr);
            if (startMinutes === -1) return false;
            const endMinutes = startMinutes + totalDuration;

            // Check Business Hours (8:00 AM = 480 mins, 9:00 PM = 1260 mins)
            if (startMinutes < 480 || endMinutes > 1260) return false;

            // Check exact interval collision against all booked intervals
            for (const interval of bookedIntervals) {
                if (doIntervalsOverlap(startMinutes, endMinutes, interval.startMin, interval.endMin)) {
                    return false;
                }
            }
            return true;
        };

        let availableMorning = baseTimes.morning.filter(isSlotFit);
        let availableAfternoon = baseTimes.afternoon.filter(isSlotFit);
        let availableNight = baseTimes.night.filter(isSlotFit);

        // Merge gap slots
        for (const gap of gapSlots) {
            if (!isSlotFit(gap)) continue;
            const mins = timeToMinutes(gap);
            if (mins === -1) continue;

            if (mins < 12 * 60) {
                availableMorning.push(gap);
            } else if (mins < 18 * 60) {
                availableAfternoon.push(gap);
            } else {
                availableNight.push(gap);
            }
        }

        // Deduplicate and sort
        const sortByTime = (a: string, b: string) => timeToMinutes(a) - timeToMinutes(b);
        availableMorning = Array.from(new Set(availableMorning)).sort(sortByTime);
        availableAfternoon = Array.from(new Set(availableAfternoon)).sort(sortByTime);
        availableNight = Array.from(new Set(availableNight)).sort(sortByTime);

        const todayBogota = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
        const selectedDateStr = format(date, 'yyyy-MM-dd');

        if (selectedDateStr === todayBogota) {
            const bogotaTimeStr = new Date().toLocaleTimeString("en-US", { timeZone: "America/Bogota", hour12: false });
            const [h, m] = bogotaTimeStr.split(":").map(Number);
            const nowMinutes = (h || 0) * 60 + (m || 0);
            const filterPastTimes = (times: string[]) => times.filter(t => timeToMinutes(t) > nowMinutes);

            availableMorning = filterPastTimes(availableMorning);
            availableAfternoon = filterPastTimes(availableAfternoon);
            availableNight = filterPastTimes(availableNight);
        }
        return { morning: availableMorning, afternoon: availableAfternoon, night: availableNight };
    }, [date, bookedIntervals, gapSlots, serviceIds, services]);

    const hasAvailableTimes = morning.length > 0 || afternoon.length > 0 || night.length > 0;

    const renderTimeSlots = (times: string[], title: string) => (
        times.length > 0 && (
            <div>
                <h4 className="font-semibold text-sm mb-2">{title}</h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {times.map((t) => (
                        <Button key={t} type="button" variant={time === t ? "default" : "outline"} onClick={() => setTime(t)} className="transition-all">{t}</Button>
                    ))}
                </div>
            </div>
        )
    );


    React.useEffect(() => {
        if (state.success) {
            toast({ title: "Éxito", description: state.message });
            onDataChange();
            onOpenChange(false);
        } else if (state.message && !state.success) {
            toast({ title: "Error", description: state.message || "Por favor, corrige los errores en el formulario.", variant: "destructive" });
        }
    }, [state, toast, onDataChange, onOpenChange]);

    const serviceOptions = services.map(s => ({ label: `${s.name} ($${parseInt(String(s.price).replace(/\D/g, '') || '0').toLocaleString('es-CO')})`, value: s.id }));

    return (
        <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
                <DialogTitle>Añadir Nueva Cita</DialogTitle>
                <DialogDescription>
                    Agenda una nueva cita para un cliente. Se enviará un correo de confirmación.
                </DialogDescription>
            </DialogHeader>
            <form action={formAction} className="grid gap-4 py-4">
                <input type="hidden" name="date" value={date ? format(date, "yyyy-MM-dd") : ""} />
                <input type="hidden" name="service" value={serviceIds.join(',')} />
                <input type="hidden" name="time" value={time} />
                <input type="hidden" name="barberId" value={barberId} />

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="barberId" className="sm:text-right">Barbero</Label>
                    <div className="sm:col-span-3">
                        <Select onValueChange={setBarberId} value={barberId} name="barberId">
                            <SelectTrigger><SelectValue placeholder="Selecciona un barbero" /></SelectTrigger>
                            <SelectContent>
                                {team.filter(t => t.isAvailable).map(barber => (
                                    <SelectItem key={barber.id} value={barber.id}>{barber.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {state.errors?.barberId && <p className="text-sm text-destructive mt-1">{state.errors.barberId[0]}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="name" className="sm:text-right">Cliente</Label>
                    <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-3" />
                    {state.errors?.name && <p className="sm:col-start-2 sm:col-span-3 text-sm text-destructive mt-1">{state.errors.name[0]}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="email" className="sm:text-right">Email</Label>
                    <Input id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sm:col-span-3" type="email" />
                    {state.errors?.email && <p className="sm:col-start-2 sm:col-span-3 text-sm text-destructive mt-1">{state.errors.email[0]}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="phone" className="sm:text-right">Teléfono</Label>
                    <Input id="phone" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="sm:col-span-3" type="tel" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                    <Label className="sm:text-right pt-2">Servicios</Label>
                    <div className="sm:col-span-3">
                        <MultiSelect
                            options={serviceOptions}
                            onValueChange={setServiceIds}
                            value={serviceIds}
                            placeholder="Selecciona los servicios..."
                        />
                        {state.errors?.service && <p className="text-sm text-destructive mt-1">{state.errors.service[0]}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
                    <Label className="sm:text-right pt-2">Fecha y Hora</Label>
                    <div className="sm:col-span-3 space-y-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                            </PopoverContent>
                        </Popover>

                        <div className="space-y-4">
                            {isFetchingTimes ? (
                                <div className="flex items-center justify-center h-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                            ) : barberId && hasAvailableTimes ? (
                                <>
                                    {renderTimeSlots(morning, "Mañana")}
                                    {renderTimeSlots(afternoon, "Tarde")}
                                    {renderTimeSlots(night, "Noche")}
                                </>
                            ) : barberId ? (
                                <div className="text-center text-sm text-muted-foreground pt-4">No hay horas disponibles.</div>
                            ) : (
                                <div className="text-center text-sm text-muted-foreground pt-4">Selecciona un barbero para ver las horas.</div>
                            )}
                        </div>
                        {state.errors?.time && <p className="text-sm text-destructive mt-1">{state.errors.time[0]}</p>}
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                    <Button type="submit">
                        <PlusCircle className="mr-2 h-4 w-4" /> Guardar Cita
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    )
}

function SlotActionDialog({ onOpenChange, onSelectAction }: { onOpenChange: (open: boolean) => void, onSelectAction: (action: 'appointment' | 'block') => void }) {
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>¿Qué deseas hacer?</DialogTitle>
                <DialogDescription>
                    Has seleccionado un horario. Elige la acción que quieres realizar.
                </DialogDescription>
            </DialogHeader>
            <div className="flex justify-around py-4">
                <Button variant="outline" onClick={() => onSelectAction('appointment')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Crear Cita
                </Button>
                <Button variant="destructive" onClick={() => onSelectAction('block')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Bloquear Horario
                </Button>
            </div>
        </DialogContent>
    )
}


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


function NotificationsManagerDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
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
        fetchData();
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

    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Gestionar Notificaciones</DialogTitle>
                <DialogDescription>Añade, edita o elimina los anuncios que aparecen en la página de inicio.</DialogDescription>
            </DialogHeader>

            <div className="py-4">
                <div className="flex justify-end mb-4">
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
                {isLoading ? (
                    <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : notifications.length > 0 ? (
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
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
            </div>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
            </DialogFooter>
        </DialogContent>
    );
}



function AppointmentsDashboard({
    initialAppointments,
    team,
    userRole,
    onLogout,
    onDataChange,
}: {
    initialAppointments: Appointment[];
    team: TeamMember[];
    userRole: 'admin' | 'barber';
    onLogout: () => void;
    onDataChange: () => void;
}) {
    const { toast } = useToast();
    const [selectedCalendarBarber, setSelectedCalendarBarber] = React.useState<string>('all');
    const [view, setView] = React.useState<'calendar' | 'completed'>('calendar');
    const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);

    React.useEffect(() => {
        getServicesFromDB().then(res => {
            if (res && res.length > 0) setServices(res);
        }).catch(console.error);
    }, []);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash.toLowerCase();
            if (hash === '#completadas') {
                setView('completed');
            } else {
                setView('calendar');
            }

            const handlePopState = (e: PopStateEvent) => {
                const targetView = e.state?.view || (window.location.hash === '#completadas' ? 'completed' : 'calendar');
                setView(targetView);
            };

            window.addEventListener('popstate', handlePopState);
            return () => window.removeEventListener('popstate', handlePopState);
        }
    }, []);

    const handleViewChange = (newView: 'calendar' | 'completed') => {
        setView(newView);
        if (typeof window !== 'undefined') {
            const newHash = newView === 'completed' ? '#completadas' : '#calendario';
            if (window.location.hash !== newHash) {
                window.history.pushState({ view: newView }, '', newHash);
            }
        }
    };

    // Dialog visibility states
    const [isConfirmSaleOpen, setIsConfirmSaleOpen] = React.useState(false);
    const [isBlockTimeOpen, setIsBlockTimeOpen] = React.useState(false);
    const [isAddAppointmentOpen, setIsAddAppointmentOpen] = React.useState(false);
    const [isDeleteBlockOpen, setIsDeleteBlockOpen] = React.useState(false);
    const [isSlotActionOpen, setIsSlotActionOpen] = React.useState(false);
    const [isNotificationsManagerOpen, setIsNotificationsManagerOpen] = React.useState(false);
    const [isServicesManagerOpen, setIsServicesManagerOpen] = React.useState(false);


    const [slotSelectionInfo, setSlotSelectionInfo] = React.useState<SlotSelectionInfo | null>(null);

    const handleSelectSlot = (slotInfo: { start: Date, end: Date, resourceId?: string }) => {
        setSlotSelectionInfo({
            start: slotInfo.start,
            end: slotInfo.end,
            barberId: slotInfo.resourceId
        });
        setIsSlotActionOpen(true);
    };

    const handleSlotAction = (action: 'appointment' | 'block') => {
        setIsSlotActionOpen(false);
        if (action === 'appointment') {
            setIsAddAppointmentOpen(true);
        } else {
            setIsBlockTimeOpen(true);
        }
    };


    const handleSelectEvent = (event: Appointment) => {
        setSelectedAppointment(event);
        if (event.type === 'blocked') {
            setIsDeleteBlockOpen(true);
        } else if (event.status === 'pending') {
            setIsConfirmSaleOpen(true);
        }
    };

    const handleUpdateAppointment = async (appointment: Appointment) => {
        try {
            const startMin = timeToMinutes(appointment.time);
            let endMin = appointment.endTime ? timeToMinutes(appointment.endTime) : -1;
            if (endMin === -1 || endMin <= startMin) {
                endMin = startMin + 60;
            }

            // Check if moving to this time slot causes a collision with another appointment for the same barber
            const hasConflict = initialAppointments.some(apt => {
                if (apt.id === appointment.id) return false;
                if (apt.id?.startsWith('lock_') || (apt as any).type === 'lock') return false;
                if ((apt.status as string) === 'cancelled') return false;
                if (apt.barberId !== appointment.barberId || apt.date !== appointment.date) return false;

                const otherStart = timeToMinutes(apt.time);
                if (otherStart === -1) return false;
                let otherEnd = apt.endTime ? timeToMinutes(apt.endTime) : -1;
                if (otherEnd === -1 || otherEnd <= otherStart) otherEnd = otherStart + 60;

                return doIntervalsOverlap(startMin, endMin, otherStart, otherEnd);
            });

            if (hasConflict) {
                toast({
                    title: "Sobrebooking Evitado",
                    description: "No puedes mover la cita a esta hora porque se cruza con otra cita o bloqueo del barbero.",
                    variant: "destructive"
                });
                onDataChange();
                return;
            }

            const { db } = await import('@/lib/firebase');
            const { doc, updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, "appointments", appointment.id), {
                date: appointment.date,
                time: appointment.time,
                endTime: appointment.endTime || minutesToTimeStr(endMin),
                barberId: appointment.barberId
            });
            toast({ title: "Cita actualizada", description: "Cita reprogramada sin conflictos." });
            onDataChange();
        } catch (e) {
            toast({ title: "Error", description: "No se pudo actualizar la cita.", variant: "destructive" });
            onDataChange();
        }
    };

    const filteredAppointments = React.useMemo(() =>
        selectedCalendarBarber === 'all'
            ? initialAppointments
            : initialAppointments.filter(apt => apt.barberId === selectedCalendarBarber),
        [initialAppointments, selectedCalendarBarber]
    );

    const filteredTeam = React.useMemo(() =>
        selectedCalendarBarber === 'all'
            ? team
            : team.filter(t => t.id === selectedCalendarBarber),
        [team, selectedCalendarBarber]
    );

    const completedAppointments = initialAppointments.filter(apt => apt.status === 'completed' && apt.type === 'appointment');

    const handleReactivate = async (id: string) => {
        const { success, message } = await reactivateAppointment(id);
        if (success) {
            toast({ title: "Éxito", description: message });
            onDataChange();
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    }

    const handleDelete = async (id: string) => {
        const { success, message } = await deleteAppointment(id);
        if (success) {
            toast({ title: "Éxito", description: message });
            onDataChange();
        } else {
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    }

    const handleExportCompleted = () => {
        const dataToExport = completedAppointments.map(apt => {
            const { names: serviceNames, totalPrice } = getServiceDetails(apt.service);
            const barberName = team.find(b => b.id === apt.barberId)?.name || 'Desconocido';
            return {
                id_cita: apt.id,
                fecha: apt.date,
                hora: apt.time,
                cliente: apt.name,
                email_cliente: apt.email || 'N/A',
                telefono_cliente: apt.phone || 'N/A',
                servicios: serviceNames,
                barbero: barberName,
                costo_total: totalPrice,
            };
        });
        downloadCSV(dataToExport, `citas-completadas-${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
            <Card>
                {view === 'calendar' && (
                    <>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-full sm:w-auto min-w-[200px]">
                                        <Select value={selectedCalendarBarber} onValueChange={setSelectedCalendarBarber}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Filtrar por barbero" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        <span>Todos los barberos</span>
                                                    </div>
                                                </SelectItem>
                                                {team.filter(t => t.isAvailable).map(barber => (
                                                    <SelectItem key={barber.id} value={barber.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Scissors className="h-4 w-4" />
                                                            <span>{barber.name}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Dialog open={isAddAppointmentOpen} onOpenChange={setIsAddAppointmentOpen}>
                                        <Dialog open={isBlockTimeOpen} onOpenChange={setIsBlockTimeOpen}>
                                            <Dialog open={isSlotActionOpen} onOpenChange={setIsSlotActionOpen}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => setIsAddAppointmentOpen(true)}>
                                                            <PlusCircle className="mr-2 h-4 w-4" />
                                                            Añadir Cita
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => setIsBlockTimeOpen(true)}>
                                                            <Lock className="mr-2 h-4 w-4" />
                                                            Bloquear Horario
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {userRole === 'admin' && (
                                                            <>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href="/admin/team">
                                                                        <Users2 className="mr-2 h-4 w-4" />
                                                                        Gestionar Equipo
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => setIsNotificationsManagerOpen(true)}>
                                                                    <Bell className="mr-2 h-4 w-4" />
                                                                    Notificaciones
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => setIsServicesManagerOpen(true)}>
                                                                    <Scissors className="mr-2 h-4 w-4" />
                                                                    Gestionar Servicios
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href="/admin/cash-flow">
                                                                        <Briefcase className="mr-2 h-4 w-4" />
                                                                        Sistema de Caja
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href="/admin/system-logs">
                                                                        <Terminal className="mr-2 h-4 w-4 text-primary" />
                                                                        Logs y Telemetría
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        <DropdownMenuItem onClick={() => handleViewChange('completed')}>
                                                            <History className="mr-2 h-4 w-4" />
                                                            Ver Citas Completadas
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <InstallPwaButton />
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={onLogout}>
                                                            <LogOut className="mr-2 h-4 w-4" />
                                                            Cerrar Sesión
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <SlotActionDialog onOpenChange={setIsSlotActionOpen} onSelectAction={handleSlotAction} />
                                            </Dialog>
                                            <BlockTimeDialog team={team} onDataChange={onDataChange} onOpenChange={setIsBlockTimeOpen} initialData={slotSelectionInfo!} />
                                        </Dialog>
                                        <AddAppointmentDialog team={team} onDataChange={onDataChange} onOpenChange={setIsAddAppointmentOpen} initialData={slotSelectionInfo!} />
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div style={{ height: '80vh' }}>
                                <AppointmentCalendar
                                    appointments={filteredAppointments}
                                    team={team}
                                    services={services}
                                    onAppointmentUpdate={handleUpdateAppointment}
                                    onSelectEvent={handleSelectEvent}
                                    onSelectSlot={handleSelectSlot}
                                />
                            </div>
                        </CardContent>
                    </>
                )}
                {view === 'completed' && (
                    <>
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <Button variant="ghost" size="sm" onClick={() => handleViewChange('calendar')} className="mb-2 -ml-4">
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Calendario
                                </Button>
                                <CardTitle>Citas Completadas</CardTitle>
                                <CardDescription>Lista de citas que ya han sido finalizadas y cobradas.</CardDescription>
                            </div>
                            {userRole === 'admin' && (
                                <Button onClick={handleExportCompleted} variant="outline" size="sm" disabled={completedAppointments.length === 0}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar a CSV
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            {completedAppointments.length > 0 ? (
                                <>
                                    {/* Mobile Card View */}
                                    <div className="space-y-4 md:hidden p-4">
                                        {completedAppointments.map((apt) => {
                                            const { names: serviceNames } = getServiceDetails(apt.service);
                                            const barberName = team.find(b => b.id === apt.barberId)?.name || 'Desconocido';
                                            return (
                                                <Card key={apt.id} className="text-muted-foreground bg-muted/50 overflow-hidden">
                                                    <CardContent className="p-4 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-semibold text-foreground">{apt.name}</p>
                                                                <p className="text-sm">{serviceNames}</p>
                                                                <Badge variant="outline" className="mt-2">{format(parse(apt.date, 'yyyy-MM-dd', new Date()), "d MMM yyyy", { locale: es })} - {apt.time}</Badge>
                                                            </div>
                                                            <p className="text-sm">{barberName}</p>
                                                        </div>
                                                    </CardContent>
                                                    {userRole === 'admin' && (
                                                        <CardFooter className="bg-muted/60 px-4 py-2">
                                                            <div className="flex w-full justify-end gap-2">
                                                                <Button size="sm" variant="ghost" onClick={() => handleReactivate(apt.id)}>
                                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                                    Reactivar
                                                                </Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            Eliminar
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará la cita y su transacción de venta asociada permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(apt.id)}>Sí, eliminar</AlertDialogAction></AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </CardFooter>
                                                    )}
                                                </Card>
                                            )
                                        })}
                                    </div>
                                    {/* Desktop Table View */}
                                    <div className="hidden md:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Cliente</TableHead>
                                                    <TableHead>Servicio(s)</TableHead>
                                                    <TableHead>Barbero</TableHead>
                                                    {userRole === 'admin' && <TableHead className="text-right">Acciones</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {completedAppointments.map((apt) => {
                                                    const { names: serviceNames } = getServiceDetails(apt.service);
                                                    const barberName = team.find(b => b.id === apt.barberId)?.name || 'Desconocido';
                                                    return (
                                                        <TableRow key={apt.id} className="text-muted-foreground bg-muted/50">
                                                            <TableCell>
                                                                <Badge variant="outline">{format(parse(apt.date, 'yyyy-MM-dd', new Date()), "d MMM yyyy", { locale: es })}</Badge>
                                                            </TableCell>
                                                            <TableCell className="font-medium text-foreground">{apt.name}</TableCell>
                                                            <TableCell>{serviceNames}</TableCell>
                                                            <TableCell>{barberName}</TableCell>
                                                            {userRole === 'admin' && (
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon">
                                                                                <MoreVertical className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent>
                                                                            <DropdownMenuItem onClick={() => handleReactivate(apt.id)}>
                                                                                <RefreshCw className="mr-2 h-4 w-4" />
                                                                                Reactivar
                                                                            </DropdownMenuItem>
                                                                            <AlertDialog>
                                                                                <AlertDialogTrigger asChild>
                                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                                        Eliminar
                                                                                    </DropdownMenuItem>
                                                                                </AlertDialogTrigger>
                                                                                <AlertDialogContent>
                                                                                    <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción eliminará la cita y su transacción de venta asociada permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                                                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(apt.id)}>Sí, eliminar</AlertDialogAction></AlertDialogFooter>
                                                                                </AlertDialogContent>
                                                                            </AlertDialog>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            )}
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center h-48 flex flex-col justify-center items-center">
                                    <p className="text-muted-foreground">Aún no se han completado citas.</p>
                                </div>
                            )}
                        </CardContent>
                    </>
                )}
            </Card>
            <Dialog open={isConfirmSaleOpen} onOpenChange={setIsConfirmSaleOpen}>
                {selectedAppointment && selectedAppointment.type === 'appointment' && (
                    <ConfirmSaleDialog
                        appointment={selectedAppointment}
                        team={team}
                        onSaleConfirmed={onDataChange}
                        onAppointmentDeleted={onDataChange}
                        onOpenChange={setIsConfirmSaleOpen}
                    />
                )}
            </Dialog>
            <Dialog open={isDeleteBlockOpen} onOpenChange={setIsDeleteBlockOpen}>
                {selectedAppointment && selectedAppointment.type === 'blocked' && (
                    <DeleteBlockDialog
                        slot={selectedAppointment}
                        team={team}
                        onDeleted={onDataChange}
                        onOpenChange={setIsDeleteBlockOpen}
                    />
                )}
            </Dialog>
            <Dialog open={isNotificationsManagerOpen} onOpenChange={setIsNotificationsManagerOpen}>
                <NotificationsManagerDialog onOpenChange={setIsNotificationsManagerOpen} />
            </Dialog>
            <Dialog open={isServicesManagerOpen} onOpenChange={setIsServicesManagerOpen}>
                <ServicesManagerDialog onOpenChange={setIsServicesManagerOpen} />
            </Dialog>
        </div>
    );
}

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);
    const [userRole, setUserRole] = React.useState<'admin' | 'barber' | null>(null);
    const [appointments, setAppointments] = React.useState<Appointment[]>([]);
    const [team, setTeam] = React.useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [initialAppointments, initialTeam] = await Promise.all([
                getAllAppointments(),
                getTeam()
            ]);
            setAppointments(initialAppointments);
            setTeam(initialTeam);
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        checkAdminSession().then(session => {
            if (session.isAuthenticated && session.role) {
                setIsAuthenticated(true);
                setUserRole(session.role);
                sessionStorage.setItem('isAdminAuthenticated', 'true');
                sessionStorage.setItem('userRole', session.role);
                loadData();
            } else {
                sessionStorage.removeItem('isAdminAuthenticated');
                sessionStorage.removeItem('userRole');
                setIsAuthenticated(false);
                setUserRole(null);
                setIsLoading(false);
            }
        }).catch(() => {
            setIsLoading(false);
        });
    }, [loadData]);

    const handleLoginSuccess = (role: 'admin' | 'barber') => {
        setIsAuthenticated(true);
        setUserRole(role);
        loadData();
    };

    const handleLogout = async () => {
        await logoutAdmin();
        sessionStorage.removeItem('isAdminAuthenticated');
        sessionStorage.removeItem('userRole');
        setIsAuthenticated(false);
        setUserRole(null);
        setAppointments([]);
        setTeam([]);
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated || !userRole) {
        return <AdminLoginPage onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <AppointmentsDashboard
            initialAppointments={appointments}
            team={team}
            userRole={userRole}
            onLogout={handleLogout}
            onDataChange={loadData}
        />
    );
}





