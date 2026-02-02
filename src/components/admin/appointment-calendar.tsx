
'use client';

import * as React from 'react';
import { Calendar, dateFnsLocalizer, Views, EventProps, View, SlotInfo } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, getDay, parse, startOfWeek, parseISO, addMinutes, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

import type { Appointment, TeamMember } from '@/app/actions';
import { services as allServices } from '@/lib/data';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';

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

const DragAndDropCalendar = withDragAndDrop(Calendar);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId: string;
  resource: Appointment;
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  team: TeamMember[];
  onAppointmentUpdate: (appointment: Appointment) => void;
  onSelectEvent: (event: Appointment) => void;
  onSelectSlot: (slotInfo: {start: Date, end: Date, resourceId?: string}) => void;
}

const getServiceDetails = (ids: string) => {
  if (!ids) return { names: 'Servicio Desconocido' };
  const serviceIds = ids.split(',');
  const chosenServices = allServices.filter(s => serviceIds.includes(s.id.trim()));
  const names = chosenServices.map(s => s.name).join(', ');
  return { names };
};

const getServicesDuration = (ids: string): number => {
    if (!ids) return 60; // Default a 60 minutos si no hay servicios
    const serviceIds = ids.split(',');
    const totalDuration = allServices
        .filter(s => serviceIds.includes(s.id.trim()))
        .reduce((total, s) => total + s.duration, 0);
    return totalDuration > 0 ? totalDuration : 60; // Si no se encuentra o la duración es 0, default a 60.
};

const getBarberColor = (barberId: string) => {
    if (barberId === 'alan-martinez') {
        return 'var(--rbc-alan-accent)';
    } else if (barberId === 'stiven-dorado') {
        return 'var(--rbc-stiven-accent)';
    }
    // Default or for other barbers
    return 'var(--rbc-accent-color)';
}

const CustomWeekHeader = ({ date }: { date: Date }) => {
    const dayName = format(date, 'EEE', { locale: es }).toUpperCase();
    const dayNumber = format(date, 'd');
    const isCurrentDay = isToday(date);

    return (
      <div className="flex flex-col items-center">
        <span className="text-xs text-muted-foreground">{dayName}</span>
        <div className={cn("calendar-day-button", isCurrentDay && "today")}>
            {dayNumber}
        </div>
      </div>
    );
};

const NoopComponent = () => null;


export function AppointmentCalendar({ appointments, team, onAppointmentUpdate, onSelectEvent, onSelectSlot }: AppointmentCalendarProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [view, setView] = React.useState<View>(isMobile ? Views.DAY : Views.WEEK);
  const [date, setDate] = React.useState(new Date());

  const resources = React.useMemo(() => team
    .filter(member => member.isAvailable)
    .map(member => ({
        resourceId: member.id,
        resourceTitle: member.name,
        resourceImage: member.imageUrl,
        resourceRole: member.role,
        resourceColor: getBarberColor(member.id),
  })), [team]);
  
  const isSingleResourceView = resources.length === 1;

  const events = React.useMemo(() => {
    return appointments.map((apt) => {
      const parseTime = (timeStr: string) => {
        if (!timeStr) return null;
        const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!parts) return null;
        let hours = parseInt(parts[1], 10);
        const minutes = parseInt(parts[2], 10);
        const modifier = parts[3].toUpperCase();

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        
        const date = parseISO(apt.date);
        date.setHours(hours, minutes, 0, 0);
        return date;
      }

      const start = parseTime(apt.time);
      if (!start) return null;

      let end;
      if (apt.type === 'blocked' && apt.endTime) {
        end = parseTime(apt.endTime);
      } else {
        const duration = getServicesDuration(apt.service);
        end = addMinutes(start, duration);
      }
      
      if (!end) return null;


      return {
        id: apt.id,
        title: `${apt.name}`,
        start,
        end,
        resourceId: apt.barberId,
        resource: apt,
      };
    }).filter((e): e is CalendarEvent => e !== null);
  }, [appointments]);

  const onEventDrop: withDragAndDropProps['onEventDrop'] = (data) => {
    const { start, end, event, resourceId } = data;
    
    const originalAppointment = appointments.find(a => a.id === (event as CalendarEvent).id);
    if (!originalAppointment) return;

    const newStartDate = new Date(start);
    // Round to the nearest hour by setting minutes and seconds to 0
    newStartDate.setMinutes(0);
    newStartDate.setSeconds(0);
    newStartDate.setMilliseconds(0);
    
    const originalDuration = event.end.getTime() - event.start.getTime();
    const newEnd = new Date(newStartDate.getTime() + originalDuration);

    const startTimeFormatted = format(newStartDate, 'hh:mm a');
    const endTimeFormatted = format(newEnd, 'hh:mm a');
    
    const updatedAppointment: Appointment = {
        ...originalAppointment,
        date: format(newStartDate, 'yyyy-MM-dd'),
        time: startTimeFormatted,
        endTime: originalAppointment.type === 'blocked' ? endTimeFormatted : originalAppointment.endTime,
        barberId: resourceId as string,
    };
    
    onAppointmentUpdate(updatedAppointment);
  };
  
  const EventComponent = (props: EventProps<CalendarEvent>) => {
      const { resource } = props.event;
      const { names: serviceNames } = resource.type === 'appointment' ? getServiceDetails(resource.service) : { names: '' };
      const barber = team.find(b => b.id === props.event.resourceId);

      return (
          <div title={props.title} className="p-1 h-full text-xs rounded-sm">
              <strong className="block truncate font-bold">{props.title}</strong>
              {resource.type === 'appointment' ? (
                <span className="block truncate">{serviceNames}</span>
              ) : (
                <span className="block truncate text-gray-300">Bloqueado</span>
              )}
              {view !== 'day' && barber && <span className="text-gray-300 block truncate">{barber.name}</span>}
          </div>
      );
  }

  const ResourceHeader = ({ resource }: { resource: any }) => {
    return (
      <div className="flex flex-col items-center p-2 text-center">
        <Image src={resource.resourceImage} alt={resource.resourceTitle} width={40} height={40} className="rounded-full mb-1 object-cover aspect-square" />
        <p className="font-semibold text-sm text-gray-800">{resource.resourceTitle}</p>
        <p className="text-xs text-gray-700">{resource.resourceRole}</p>
      </div>
    );
  };
  
  const isWeekView = view === Views.WEEK;


  return (
    <>
      <div style={{ height: '80vh' }}>
        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          onEventDrop={onEventDrop}
          onEventResize={() => {}} // Resizing disabled for now
          onSelectEvent={(event) => onSelectEvent(event.resource)}
          onSelectSlot={(slotInfo: SlotInfo) => onSelectSlot({ start: slotInfo.start, end: slotInfo.end, resourceId: slotInfo.resourceId })}
          resizable={false}
          selectable
          popup={true}
          view={view}
          onView={setView}
          views={[Views.DAY, Views.WEEK, Views.MONTH]}
          defaultView={isMobile ? Views.DAY : Views.WEEK}
          date={date}
          onNavigate={setDate}
          resources={isWeekView || isSingleResourceView ? undefined : resources}
          resourceIdAccessor={isWeekView || isSingleResourceView ? undefined : "resourceId"}
          resourceTitleAccessor={isWeekView || isSingleResourceView ? undefined : "resourceTitle"}
          culture='es'
          formats={{
            timeGutterFormat: 'p', // e.g., 8 AM
            eventTimeRangeFormat: () => null,
            dayFormat: 'EEE d', // e.g., lun 2
            dayHeaderFormat: (date, culture, localizer) => localizer.format(date, 'EEE d', culture),
            dayRangeHeaderFormat: ({ start, end }, culture, localizer) =>
                `${localizer.format(start, 'd MMM', culture)} - ${localizer.format(end, 'd MMM', culture)}`,
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
            event: "Cita",
            noEventsInRange: "No hay citas en este rango.",
          }}
          min={new Date(0, 0, 0, 8, 0, 0)} // 8:00 AM
          max={new Date(0, 0, 0, 22, 0, 0)} // 10:00 PM
          step={60}
          timeslots={1}
          components={{
              event: EventComponent,
              resourceHeader: isWeekView || isSingleResourceView ? undefined : ResourceHeader,
              week: {
                  header: CustomWeekHeader,
              },
              month: {
                  dateHeader: ({ label }) => <span>{label}</span>,
              }
          }}
          eventPropGetter={(event) => {
              const isBlocked = event.resource.type === 'blocked';
              const backgroundColor = isBlocked ? '#000000' : getBarberColor(event.resourceId);
              const color = '#ffffff';
              const style = {
                  backgroundColor: backgroundColor,
                  color: color,
                  borderRadius: '4px',
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              };
              return { style };
          }}
          dayLayoutAlgorithm={isSingleResourceView || isWeekView ? "overlap" : "no-overlap"}
        />
      </div>
    </>
  );
}
