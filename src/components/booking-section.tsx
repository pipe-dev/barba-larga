
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarIcon, Loader2, ArrowLeft, Edit2, PlusCircle, Trash2, AlertTriangle, Phone, Clock } from "lucide-react";
import { format, isToday as isTodayDateFns, parse } from "date-fns";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { bookAppointment, getAvailableTimesForDate, getTeam, type TeamMember } from "@/app/actions";
import { useBookingClickSound } from "@/hooks/use-booking-click-sound";
import { useToast } from "@/hooks/use-toast";
import { useBooking } from "@/hooks/use-booking";
import { useSuccessSound } from "@/hooks/use-success-sound";
import { useShaverSound } from "@/hooks/use-shaver-sound";
import { services as allServices, Service, getBaseAvailableTimes, SLOT_INTERVAL_MINUTES } from "@/lib/data";
import { getServicesFromDB } from "@/app/actions/services";
import { getSafeImageUrl } from "@/lib/image-validation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmationStep } from "@/components/confirmation-step";
import { Separator } from "@/components/ui/separator";
import { MultiSelect } from "@/components/ui/multi-select";

type Step = "select-barber" | "select-service" | "select-date" | "fill-details" | "confirmed";
type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';

const initialState = { message: "", errors: {}, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button variant="3d" type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Confirmar Reserva
    </Button>
  );
}

function BookingForm({ onNavigate }: { onNavigate: (scene: Scene) => void }) {
  const [state, formAction] = useActionState(bookAppointment, initialState);
  const {
    selectedServices,
    setSelectedServices,
    toggleService,
    selectedBarberId,
    setSelectedBarberId,
    resetBooking,
  } = useBooking();

  const [currentStep, setCurrentStep] = React.useState<Step>("select-date");

  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  const [bookedTimes, setBookedTimes] = React.useState<string[]>([]);
  const [gapSlots, setGapSlots] = React.useState<string[]>([]);
  const [isFetchingTimes, setIsFetchingTimes] = React.useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [team, setTeam] = React.useState<TeamMember[]>([]);
  const [services, setServices] = React.useState<Service[]>(allServices); // Initialize with static services

  const playClickSound = useBookingClickSound();
  const playShaverSound = useShaverSound();
  const playSuccessSound = useSuccessSound();
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const bookingCardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    async function fetchTeam() {
      const teamData = await getTeam();
      setTeam(teamData);
    }
    fetchTeam();
  }, []);

  React.useEffect(() => {
    const fetchServices = async () => {
      try {
        const dbServices = await getServicesFromDB();
        if (dbServices && dbServices.length > 0) {
          const merged = dbServices.map(dbS => {
            const staticS = allServices.find(s => s.id === dbS.id);
            return {
              ...dbS,
              // Keep static icon component if available, otherwise use string from DB or default
              icon: staticS ? staticS.icon : (dbS.icon || CalendarIcon), // Changed Scissors to CalendarIcon as a generic fallback
              mediaType: dbS.mediaType as 'image' | 'video',
              // Use DB price and duration, fallback to static if missing (though DB should have them)
              price: dbS.price || staticS?.price || "0",
              duration: dbS.duration || staticS?.duration || 60,
              description: dbS.description || staticS?.description || "",
              name: dbS.name || staticS?.name || "",
              mediaUrl: dbS.mediaUrl || staticS?.mediaUrl || "",
              imageHint: dbS.imageHint || staticS?.imageHint || ""
            };
          });
          setServices(merged);
        }
      } catch (error) {
        console.error("Failed to fetch dynamic services", error);
      }
    };
    fetchServices();
  }, []);

  const chosenServices = React.useMemo(() => {
    return services.filter(s => selectedServices.includes(s.id));
  }, [selectedServices, services]);

  const chosenBarber = React.useMemo(() => team.find(b => b.id === selectedBarberId), [selectedBarberId, team]);

  const totalDuration = React.useMemo(() => {
    return chosenServices.reduce((acc, s) => acc + s.duration, 0);
  }, [chosenServices]);

  const totalPrice = React.useMemo(() => {
    return chosenServices.reduce((acc, s) => acc + parseInt(s.price), 0);
  }, [chosenServices]);

  const fetchBookedTimes = React.useCallback(async (forDate: Date, barberId: string) => {
    setIsFetchingTimes(true);
    const dateString = format(forDate, "yyyy-MM-dd");
    try {
      const result = await getAvailableTimesForDate(dateString, barberId);
      const formattedBlocked = result.blocked.map(t => t.toUpperCase().replace(/\s/g, ''));
      setBookedTimes(formattedBlocked);
      setGapSlots(result.gaps); // Keep original format for display
    } catch (error) {
      console.error(error);
      toast({
        title: "Error de Disponibilidad",
        description: "No se pudieron cargar los horarios. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingTimes(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (date && selectedBarberId) {
      fetchBookedTimes(date, selectedBarberId);
    }
  }, [date, selectedBarberId, fetchBookedTimes]);

  React.useEffect(() => {
    setSelectedTime(undefined);
  }, [date, selectedBarberId]);

  React.useEffect(() => {
    if (state.success) {
      if (bookingCardRef.current) {
        bookingCardRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      setTimeout(() => {
        playSuccessSound();
        setCurrentStep("confirmed");
        if (date && selectedBarberId) {
          fetchBookedTimes(date, selectedBarberId);
        }
      }, 500);

    } else if (!state.success && state.message) {
      toast({
        title: "Error en la Reserva",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, playSuccessSound, date, fetchBookedTimes, toast, selectedBarberId]);


  const { morning, afternoon, night } = React.useMemo(() => {
    if (!date) return { morning: [], afternoon: [], night: [] };
    const baseTimes = getBaseAvailableTimes(date);

    // Robust time parser that handles both "08:00 AM" and "08:00AM"
    const timeToMinutes = (timeStr: string): number => {
      const normalized = timeStr.trim().toUpperCase();
      const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
      if (!match) return -1;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const modifier = match[3];
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    // Filter hourly slots that are directly blocked
    const filterBooked = (times: string[]) =>
      times.filter(time => !bookedTimes.includes(time.replace(/\s/g, '').toUpperCase()));

    let availableMorning = filterBooked(baseTimes.morning);
    let availableAfternoon = filterBooked(baseTimes.afternoon);
    let availableNight = filterBooked(baseTimes.night);

    // Merge gap slots into the appropriate time-of-day category
    for (const gap of gapSlots) {
      // Check gap isn't blocked (double-safety)
      if (bookedTimes.includes(gap.replace(/\s/g, '').toUpperCase())) continue;

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

    // Sort each category by time
    const sortByTime = (a: string, b: string) => timeToMinutes(a) - timeToMinutes(b);
    availableMorning.sort(sortByTime);
    availableAfternoon.sort(sortByTime);
    availableNight.sort(sortByTime);

    // Filter past times if today
    if (isTodayDateFns(date)) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const filterPastTimes = (times: string[]) => times.filter(time => timeToMinutes(time) > nowMinutes);

      availableMorning = filterPastTimes(availableMorning);
      availableAfternoon = filterPastTimes(availableAfternoon);
      availableNight = filterPastTimes(availableNight);
    }

    // Duration Fit Check: ensure the full service duration fits
    // without overlapping any blocked 10-min interval or exceeding closing time
    const bookedMinutesSet = new Set(bookedTimes.map(t => timeToMinutes(t)));

    const isSlotFit = (startTimeStr: string) => {
      const startMinutes = timeToMinutes(startTimeStr);
      if (startMinutes === -1) return false;
      const endMinutes = startMinutes + totalDuration;

      // Check Closing Time (9:00 PM = 1260 mins)
      if (endMinutes > 1260) return false;

      // Check every 10-min interval for overlap
      for (let t = startMinutes; t < endMinutes; t += SLOT_INTERVAL_MINUTES) {
        if (bookedMinutesSet.has(t)) {
          return false;
        }
      }
      return true;
    };

    availableMorning = availableMorning.filter(isSlotFit);
    availableAfternoon = availableAfternoon.filter(isSlotFit);
    availableNight = availableNight.filter(isSlotFit);

    return {
      morning: availableMorning,
      afternoon: availableAfternoon,
      night: availableNight,
    };
  }, [date, bookedTimes, gapSlots, totalDuration]);

  const hasAvailableTimes = morning.length > 0 || afternoon.length > 0 || night.length > 0;


  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    playClickSound();
    setIsCalendarOpen(false);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    playClickSound();
    setCurrentStep("fill-details");
    if (bookingCardRef.current) {
      bookingCardRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const resetFlow = () => {
    formRef.current?.reset();
    resetBooking();
    setDate(new Date());
    setSelectedTime(undefined);
    setCurrentStep("select-date");

    // Clear useActionState
    state.success = false;
    state.message = "";
    state.errors = {};

    onNavigate('team');
  };

  const changeStep = (step: Step) => {
    setCurrentStep(step);
  }

  const handleBackToServices = () => {
    setCurrentStep('select-service');
    onNavigate('services');
  };

  const handleChangeBarber = () => {
    setSelectedBarberId(null);
    onNavigate('team');
  };

  const renderTimeSlots = (times: string[], title: string) => (
    times.length > 0 && (
      <div>
        <h4 className="font-semibold text-sm mb-2">{title}</h4>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {times.map((time) => (
            <Button key={time} variant={selectedTime === time ? "default" : "outline"} onClick={() => handleTimeSelect(time)} className="transition-all">{time}</Button>
          ))}
        </div>
      </div>
    )
  );

  const selectionContent = (
    <div className="p-6 md:p-8 flex flex-col gap-6">
      <div className="space-y-2">
        <Label>2. Selecciona una fecha</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              initialFocus
              locale={es}
              disabled={(day) => day < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label>3. Selecciona una hora</Label>
        {isFetchingTimes ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : hasAvailableTimes ? (
          <div className="space-y-4">
            {renderTimeSlots(morning, "Mañana")}
            {renderTimeSlots(afternoon, "Tarde")}
            {renderTimeSlots(night, "Noche")}
          </div>
        ) : (
          <div className="flex items-center justify-center text-center h-24 mt-2 border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">
              {date?.getDay() === 0 ? "Cerrado los Domingos" : `No hay horas disponibles para ${chosenBarber?.name} este día.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const serviceOptions = services.map(s => ({ label: s.name, value: s.id }));

  return (
    <section id="booking" className="py-12 md:py-24">
      <Card ref={bookingCardRef} className="max-w-4xl mx-auto overflow-hidden transition-all duration-500">

        {chosenServices.length > 0 && chosenBarber ? (
          <>
            {currentStep === "select-date" && (
              <div className="grid md:grid-cols-2 animate-in fade-in-0 duration-500">
                <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r">
                  <Button variant="ghost" size="sm" onClick={() => onNavigate('services')} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a servicios
                  </Button>
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-xl sm:text-2xl">Resumen de tu Selección</CardTitle>
                  </CardHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-3">
                        <Image src={getSafeImageUrl(chosenBarber.imageUrl)} alt={chosenBarber.name} width={40} height={40} className="rounded-full" />
                        <div>
                          <p className="text-sm text-muted-foreground">Barbero</p>
                          <p className="font-semibold">{chosenBarber.name}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleChangeBarber}>Cambiar</Button>
                    </div>

                    <Separator />
                    <Label>1. Servicios Seleccionados</Label>
                    <div className="space-y-3">
                      {chosenServices.map(service => (
                        <div key={service.id} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="relative h-16 w-16 rounded-md overflow-hidden shrink-0">
                              {service.mediaType === 'video' ? (
                                <video src={service.mediaUrl} autoPlay loop muted playsInline className="object-cover h-full w-full" />
                              ) : (
                                <Image src={getSafeImageUrl(service.mediaUrl)} alt={service.name} width={64} height={64} className="object-cover h-full w-full" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-sm sm:text-base">{service.name}</p>
                              <p className="text-sm font-bold text-primary">${parseInt(service.price).toLocaleString('es-CO')}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" onClick={() => toggleService(service.id)}>
                            <Trash2 className="h-5 w-5 text-destructive" /><span className="sr-only">Quitar {service.name}</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Duración Total Estimada</span>
                        <span className="font-semibold">{totalDuration} min</span>
                      </div>
                      <div className="flex justify-between items-center font-bold text-base">
                        <span>Total Estimado</span>
                        <span>${totalPrice.toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => onNavigate('services')}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Añadir más servicios
                    </Button>
                  </div>
                </div>

                <div className="contents md:block">
                  {selectionContent}
                </div>

              </div>
            )}

            {currentStep === "fill-details" && (
              <div className="p-6 md:p-8 animate-in fade-in-0 duration-500">
                <Button variant="ghost" size="sm" onClick={() => changeStep('select-date')} className="mb-4">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-3xl">Completa tus Datos</CardTitle>
                  <CardDescription>Estás a punto de finalizar tu reserva.</CardDescription>
                </CardHeader>

                <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-3">
                  <h3 className="font-semibold">Resumen de tu Cita</h3>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Con {chosenBarber.name}</p>
                      <p className="text-sm text-muted-foreground">{chosenServices.map(s => s.name).join(', ')}</p>
                      <p className="text-sm text-muted-foreground">{date ? format(date, "PPP", { locale: es }) : ""} a las {selectedTime}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mt-2">
                        <p className="font-bold">Total: ${totalPrice.toLocaleString('es-CO')}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> {totalDuration} min</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Button variant="outline" size="sm" onClick={() => changeStep('select-date')}>
                        <Edit2 className="mr-2 h-3 w-3" /> Cambiar
                      </Button>
                    </div>
                  </div>
                </div>

                <form ref={formRef} action={formAction} className="space-y-6">
                  <input type="hidden" name="barberId" value={selectedBarberId || ""} />
                  <input type="hidden" name="service" value={selectedServices.join(',')} />
                  <input type="hidden" name="date" value={date ? format(date, "yyyy-MM-dd") : ""} />
                  <input type="hidden" name="time" value={selectedTime || ""} />

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input id="name" name="name" placeholder="Tu nombre" required />
                      {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Número de Teléfono</Label>
                      <Input id="phone" name="phone" type="tel" placeholder="Tu número" />
                      {state.errors?.phone && <p className="text-sm text-destructive">{state.errors.phone[0]}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input id="email" name="email" type="email" placeholder="tu@email.com" required />
                    {state.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
                  </div>

                  {state.errors?.time && <p className="text-sm text-destructive">{state.errors.time[0]}</p>}
                  {state.errors?.date && <p className="text-sm text-destructive">{state.errors.date[0]}</p>}
                  {state.errors?.service && <p className="text-sm text-destructive">{state.errors.service[0]}</p>}
                  {state.errors?.barberId && <p className="text-sm text-destructive">{state.errors.barberId[0]}</p>}

                  <SubmitButton />
                </form>
              </div>
            )}

            {currentStep === "confirmed" && (
              <ConfirmationStep
                barberName={chosenBarber.name}
                serviceName={chosenServices.map(s => s.name).join(', ')}
                date={date ? format(date, "PPP", { locale: es }) : ""}
                time={selectedTime || ""}
                onBookAnother={resetFlow}
              />
            )}
          </>
        ) : (
          <div className="p-8 text-center animate-in fade-in-0 duration-500">
            <CardHeader className="p-0">
              <CardTitle className="text-3xl">
                SELECCIONA PARA CONTINUAR
              </CardTitle>
              <CardDescription className="mt-4">
                {!chosenBarber && "Por favor, selecciona un barbero para continuar."}
                {chosenBarber && chosenServices.length === 0 && (
                  <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => onNavigate('services')}>
                    Toca aquí y selecciona al menos un servicio para continuar.
                  </button>
                )}
              </CardDescription>
            </CardHeader>
          </div>
        )}
      </Card>
    </section>
  );
}

export function BookingSection({ onNavigate }: { onNavigate: (scene: Scene) => void }) {
  return (
    <BookingForm onNavigate={onNavigate} />
  );
}

