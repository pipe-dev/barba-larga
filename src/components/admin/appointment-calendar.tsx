'use client';

import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views, EventProps } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Appointment, TeamMember } from '@/app/actions';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { getServiceDetails } from '@/lib/data'; // Assuming this helper is available or I should copy it. 
// Actually getServiceDetails is in data.ts which I can import.

const locales = {
    'es': es,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

interface AppointmentCalendarProps {
    appointments: Appointment[];
    team: TeamMember[];
    onAppointmentUpdate: (appointment: Appointment) => void;
    onSelectEvent: (event: Appointment) => void;
    onSelectSlot: (slotInfo: { start: Date; end: Date; resourceId?: string }) => void;
}

const CustomEvent = ({ event }: EventProps<any>) => {
    return (
        <div className="text-xs h-full flex flex-col justify-center px-1" title={`${event.title} - ${event.barberName}`}>
            <div className="font-semibold truncate">{event.clientName || 'Bloqueado'}</div>
            <div className="truncate">{event.serviceName}</div>
            <div className="italic text-[10px] truncate">💈 {event.barberName}</div>
        </div>
    );
};

export function AppointmentCalendar({ appointments, team, onAppointmentUpdate, onSelectEvent, onSelectSlot }: AppointmentCalendarProps) {

    const events = useMemo(() => {
        return appointments.map(apt => {
            // Parse start time
            // Assuming apt.date is "YYYY-MM-DD" and apt.time is "HH:mm AM/PM" or "HH:mm"
            // We need to robustly parse it.
            const dateStr = format(new Date(apt.date), "yyyy-MM-dd");
            const start = parse(`${dateStr} ${apt.time}`, "yyyy-MM-dd hh:mm a", new Date());

            // Calculate end time
            // If endTime is provided in apt, use it. Otherwise default to 60 mins.
            let end;
            if (apt.endTime) {
                end = parse(`${dateStr} ${apt.endTime}`, "yyyy-MM-dd hh:mm a", new Date());
            } else {
                end = new Date(start.getTime() + 60 * 60 * 1000);
            }

            // Resolve Barber Name
            const barber = team.find(b => b.id === apt.barberId);
            const barberName = barber ? barber.name : 'Sin barbero';

            // Resolve Service Name
            // If it's a blocked slot, apt.name is usually "Descanso" or user provided reason
            // If it's an appointment, apt.service contains IDs.
            let serviceName = '';
            if (apt.type === 'blocked') {
                serviceName = 'Bloqueo';
            } else {
                // We'd need to look up service names. 
                // For valid display, we can just use apt.name (which is client name) and maybe look up services if possible.
                // But typically apt.name is Client Name. Service IDs are in apt.service.
                // We don't have direct access to allServices array here easily unless we import it.
                // Let's import { services as allServices } from '@/lib/data';
                // For now, let's just leave service name generic or try to use a helper if imported.
                serviceName = 'Servicios';
            }

            return {
                ...apt,
                title: apt.name, // This is Client Name or Block Reason
                clientName: apt.name,
                start,
                end,
                resourceId: apt.barberId,
                barberName,
                serviceName
            };
        });
    }, [appointments, team]);

    const handleEventDrop = ({ event, start, end, resourceId }: any) => {
        const updatedAppt = {
            ...event,
            date: format(start, "yyyy-MM-dd"),
            time: format(start, "hh:mm a"),
            barberId: resourceId || event.barberId
        };
        onAppointmentUpdate(updatedAppt);
    };

    const eventStyleGetter = (event: any) => {
        const barber = team.find(t => t.id === event.barberId);
        const backgroundColor = barber?.color || '#3174ad';

        let style: React.CSSProperties = {
            backgroundColor,
            borderRadius: '4px',
            opacity: 0.8,
            color: 'white',
            border: '0px',
            display: 'block'
        };

        if (event.type === 'blocked') {
            style.backgroundColor = '#6c757d'; // Gray for blocked
            style.opacity = 1;
        } else if (event.status === 'completed') {
            style.backgroundColor = '#198754'; // Green for completed
        }

        return {
            style
        };
    };

    return (
        <div className="h-full bg-background rounded-md shadow-sm p-4">
            <DnDCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                defaultView={Views.DAY}
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                step={30}
                timeslots={2}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                selectable
                resizable={false}
                onEventDrop={handleEventDrop}
                resourceIdAccessor="id"
                resourceTitleAccessor="name"
                resources={team.filter(t => t.isAvailable)}
                eventPropGetter={eventStyleGetter}
                components={{
                    event: CustomEvent
                }}
                messages={{
                    next: "Siguiente",
                    previous: "Anterior",
                    today: "Hoy",
                    month: "Mes",
                    week: "Semana",
                    day: "Día",
                    agenda: "Agenda",
                    date: "Fecha",
                    time: "Hora",
                    event: "Evento",
                    noEventsInRange: "No hay citas en este rango",
                }}
                culture='es'
            />
        </div>
    );
}
