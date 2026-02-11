'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { format, parse, addDays, subDays, startOfWeek, isSameDay, isToday as isTodayFn } from 'date-fns';
import { es } from 'date-fns/locale';
import { Appointment, TeamMember } from '@/app/actions';
import { getServiceDetails } from '@/lib/data';
import { ChevronLeft, ChevronRight, Ban, GripVertical } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────
type ViewMode = 'day' | 'week' | '3day';

interface CalendarEvent {
    id: string;
    title: string;
    clientName: string;
    barberName: string;
    barberId: string;
    barberColor: string;
    serviceName: string;
    start: Date;
    end: Date;
    type: 'appointment' | 'blocked';
    status: string;
    original: Appointment;
}

interface AppointmentCalendarProps {
    appointments: Appointment[];
    team: TeamMember[];
    onAppointmentUpdate: (appointment: Appointment) => void;
    onSelectEvent: (event: Appointment) => void;
    onSelectSlot: (slotInfo: { start: Date; end: Date; resourceId?: string }) => void;
}

// ─── Constants ──────────────────────────────────────────────
const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Helpers ────────────────────────────────────────────────
function timeToMinutes(dateObj: Date): number {
    return dateObj.getHours() * 60 + dateObj.getMinutes();
}

function minutesToTop(minutes: number): number {
    return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function minutesToHeight(startMin: number, endMin: number): number {
    return ((endMin - startMin) / 60) * HOUR_HEIGHT;
}

function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '55, 65, 81';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

// Deterministic color from palette when barber has no color stored
const BARBER_COLOR_PALETTE = [
    '#2563eb', // Blue (Alan)
    '#dc2626', // Red
    '#059669', // Emerald
    '#d97706', // Amber
    '#7c3aed', // Violet
    '#0891b2', // Cyan
    '#c026d3', // Fuchsia
    '#ea580c', // Orange
    '#0d9488', // Teal
    '#4f46e5', // Indigo
    '#be123c', // Rose
    '#65a30d', // Lime
];

function getBarberFallbackColor(barberId: string): string {
    let hash = 0;
    for (let i = 0; i < barberId.length; i++) {
        hash = barberId.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Skip index 0 (Alan's blue) to avoid collisions
    const index = (Math.abs(hash) % (BARBER_COLOR_PALETTE.length - 1)) + 1;
    return BARBER_COLOR_PALETTE[index];
}

function snapToHalfHour(minutesFromTop: number): number {
    return Math.round(minutesFromTop / 30) * 30;
}

// ─── Overlap Layout Algorithm (Google Calendar style) ────────
interface LayoutInfo {
    column: number;
    totalColumns: number;
}

function computeOverlapLayout(events: CalendarEvent[]): Map<string, LayoutInfo> {
    const layoutMap = new Map<string, LayoutInfo>();
    if (events.length === 0) return layoutMap;

    // Sort by start time, then by end time descending (longer events first)
    const sorted = [...events].sort((a, b) => {
        const diff = a.start.getTime() - b.start.getTime();
        if (diff !== 0) return diff;
        return b.end.getTime() - a.end.getTime();
    });

    // Group overlapping events into clusters
    const clusters: CalendarEvent[][] = [];
    let currentCluster: CalendarEvent[] = [];
    let clusterEnd = 0;

    for (const event of sorted) {
        const startMin = timeToMinutes(event.start);
        const endMin = timeToMinutes(event.end);

        if (currentCluster.length === 0 || startMin < clusterEnd) {
            // Overlaps with current cluster
            currentCluster.push(event);
            clusterEnd = Math.max(clusterEnd, endMin);
        } else {
            // New cluster
            clusters.push(currentCluster);
            currentCluster = [event];
            clusterEnd = endMin;
        }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // For each cluster, assign columns using a greedy algorithm
    for (const cluster of clusters) {
        const columns: CalendarEvent[][] = [];

        for (const event of cluster) {
            const eventStart = timeToMinutes(event.start);

            // Find the first column where this event doesn't overlap
            let placed = false;
            for (let col = 0; col < columns.length; col++) {
                const lastInCol = columns[col][columns[col].length - 1];
                const lastEnd = timeToMinutes(lastInCol.end);
                if (eventStart >= lastEnd) {
                    columns[col].push(event);
                    placed = true;
                    layoutMap.set(event.id, { column: col, totalColumns: 0 });
                    break;
                }
            }
            if (!placed) {
                const newCol = columns.length;
                columns.push([event]);
                layoutMap.set(event.id, { column: newCol, totalColumns: 0 });
            }
        }

        // Set totalColumns for all events in this cluster
        const totalCols = columns.length;
        for (const event of cluster) {
            const info = layoutMap.get(event.id)!;
            info.totalColumns = totalCols;
        }
    }

    return layoutMap;
}

// ─── Now-Line Component ─────────────────────────────────────
function NowLine() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const minutes = timeToMinutes(now);
    if (minutes < START_HOUR * 60 || minutes > END_HOUR * 60) return null;

    const top = minutesToTop(minutes);
    return (
        <div className="cal-now-line" style={{ top: `${top}px` }}>
            <div className="cal-now-dot" />
            <div className="cal-now-rule" />
        </div>
    );
}

// ─── Event Chip Component ───────────────────────────────────
function EventChip({
    event,
    onClick,
    onDragStart,
    isDragging,
    style: extraStyle,
}: {
    event: CalendarEvent;
    onClick: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    isDragging?: boolean;
    style?: React.CSSProperties;
}) {
    const startMin = timeToMinutes(event.start);
    const endMin = timeToMinutes(event.end);
    const top = minutesToTop(startMin);
    const height = Math.max(minutesToHeight(startMin, endMin), 24);
    const isShort = height < 44;
    const isBlocked = event.type === 'blocked';
    const isCompleted = event.status === 'completed';

    const bgColor = isBlocked ? '#6B7280' : isCompleted ? '#059669' : event.barberColor;
    const rgb = hexToRgb(bgColor);

    return (
        <div
            draggable={!isBlocked}
            onDragStart={onDragStart}
            onClick={onClick}
            className={`cal-event-chip ${isDragging ? 'dragging' : ''}`}
            style={{
                top: `${top}px`,
                height: `${height}px`,
                '--chip-color': bgColor,
                '--chip-rgb': rgb,
                ...extraStyle,
            } as React.CSSProperties}
            title={`${event.clientName} · ${event.serviceName} · ${event.barberName}`}
        >
            {/* Drag handle indicator */}
            {!isBlocked && (
                <div className="cal-drag-handle">
                    <GripVertical size={10} />
                </div>
            )}

            {isBlocked ? (
                <>
                    <div className="cal-chip-content">
                        <Ban size={12} className="shrink-0 opacity-80" />
                        <span className="cal-chip-title">Bloqueado</span>
                    </div>
                    {!isShort && (
                        <div className="cal-chip-meta">
                            <span>💈 {event.barberName}</span>
                        </div>
                    )}
                </>
            ) : isShort ? (
                <div className="cal-chip-content">
                    <span className="cal-chip-title">{event.clientName}</span>
                </div>
            ) : (
                <>
                    <div className="cal-chip-content">
                        <span className="cal-chip-title">{event.clientName}</span>
                    </div>
                    <div className="cal-chip-meta">
                        <span>{event.serviceName}</span>
                    </div>
                    {height >= 60 && (
                        <div className="cal-chip-meta">
                            <span>💈 {event.barberName}</span>
                        </div>
                    )}
                </>
            )}
            {isCompleted && <div className="cal-chip-completed-badge">✓</div>}
        </div>
    );
}

// ─── Drop Ghost Preview ─────────────────────────────────────
function DropGhost({ top, height, color }: { top: number; height: number; color: string }) {
    const rgb = hexToRgb(color);
    return (
        <div
            className="cal-drop-ghost"
            style={{
                top: `${top}px`,
                height: `${height}px`,
                '--chip-color': color,
                '--chip-rgb': rgb,
            } as React.CSSProperties}
        />
    );
}

// ─── Main Calendar Component ────────────────────────────────
export function AppointmentCalendar({ appointments, team, onAppointmentUpdate, onSelectEvent, onSelectSlot }: AppointmentCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    // ─── Drag and Drop State ────────────────────────────────
    const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
    const [dropTarget, setDropTarget] = useState<{ dayIdx: number; minuteOfDay: number } | null>(null);

    // Responsive detection
    useEffect(() => {
        const check = () => {
            if (typeof window !== 'undefined') {
                const mobile = window.innerWidth < 768;
                setIsMobile(mobile);
                if (mobile && viewMode === 'week') setViewMode('3day');
            }
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [viewMode]);

    // Auto-scroll to current hour on mount
    useEffect(() => {
        if (scrollRef.current) {
            const now = new Date();
            const currentMin = timeToMinutes(now);
            const scrollTarget = minutesToTop(currentMin) - 100;
            scrollRef.current.scrollTop = Math.max(0, scrollTarget);
        }
    }, []);

    // ─── Compute visible days ───────────────────────────────
    const visibleDays = useMemo(() => {
        if (viewMode === 'day') return [currentDate];
        if (viewMode === '3day') {
            return [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
        }
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }, [currentDate, viewMode]);

    // ─── Transform appointments to CalendarEvents ───────────
    const events = useMemo(() => {
        return appointments.map(apt => {
            const dateStr = format(new Date(apt.date + 'T12:00:00'), 'yyyy-MM-dd');
            const start = parse(`${dateStr} ${apt.time}`, 'yyyy-MM-dd hh:mm a', new Date());
            let end: Date;
            if (apt.endTime) {
                end = parse(`${dateStr} ${apt.endTime}`, 'yyyy-MM-dd hh:mm a', new Date());
            } else {
                end = new Date(start.getTime() + 60 * 60 * 1000);
            }

            const barber = team.find(b => b.id === apt.barberId);
            const barberName = barber ? barber.name : 'Sin barbero';
            const barberColor = barber?.color || getBarberFallbackColor(apt.barberId);

            let serviceName = 'Bloqueo';
            if (apt.type !== 'blocked' && apt.service) {
                const details = getServiceDetails(apt.service);
                serviceName = details.names;
            }

            return {
                id: apt.id,
                title: apt.name,
                clientName: apt.name,
                barberName,
                barberId: apt.barberId,
                barberColor,
                serviceName,
                start,
                end,
                type: apt.type,
                status: apt.status,
                original: apt,
            } as CalendarEvent;
        });
    }, [appointments, team]);

    // ─── Events for a specific day ──────────────────────────
    const getEventsForDay = useCallback((day: Date): CalendarEvent[] => {
        return events
            .filter(e => isSameDay(e.start, day))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [events]);

    // ─── Navigation handlers ────────────────────────────────
    const goToday = () => setCurrentDate(new Date());
    const goPrev = () => {
        if (viewMode === 'day') setCurrentDate(prev => subDays(prev, 1));
        else if (viewMode === '3day') setCurrentDate(prev => subDays(prev, 3));
        else setCurrentDate(prev => subDays(prev, 7));
    };
    const goNext = () => {
        if (viewMode === 'day') setCurrentDate(prev => addDays(prev, 1));
        else if (viewMode === '3day') setCurrentDate(prev => addDays(prev, 3));
        else setCurrentDate(prev => addDays(prev, 7));
    };

    // ─── Slot click handler ─────────────────────────────────
    const handleSlotClick = (day: Date, hour: number) => {
        if (draggedEvent) return; // Don't trigger on drag drops
        const start = new Date(day);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start);
        end.setHours(hour + 1, 0, 0, 0);
        onSelectSlot({ start, end });
    };

    // ─── Drag & Drop handlers ───────────────────────────────
    const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
        setDraggedEvent(event);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', event.id);
        // Create a custom drag image
        const el = e.currentTarget as HTMLElement;
        if (el) {
            e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 10);
        }
    };

    const handleDragOver = (e: React.DragEvent, dayIdx: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const column = e.currentTarget as HTMLElement;
        const rect = column.getBoundingClientRect();
        const scrollTop = scrollRef.current?.scrollTop || 0;
        const relativeY = e.clientY - rect.top + scrollTop;
        const minuteOfDay = START_HOUR * 60 + (relativeY / HOUR_HEIGHT) * 60;
        const snapped = snapToHalfHour(minuteOfDay);

        setDropTarget({ dayIdx, minuteOfDay: snapped });
    };

    const handleDragLeave = (e: React.DragEvent) => {
        // Only clear if we're leaving the column entirely
        const relatedTarget = e.relatedTarget as HTMLElement;
        const currentTarget = e.currentTarget as HTMLElement;
        if (!currentTarget.contains(relatedTarget)) {
            setDropTarget(null);
        }
    };

    const handleDrop = (e: React.DragEvent, dayIdx: number) => {
        e.preventDefault();
        if (!draggedEvent || !dropTarget) return;

        const targetDay = visibleDays[dayIdx];
        const snappedMinute = dropTarget.minuteOfDay;
        const newHour = Math.floor(snappedMinute / 60);
        const newMinute = snappedMinute % 60;

        // Calculate new time
        const newStart = new Date(targetDay);
        newStart.setHours(newHour, newMinute, 0, 0);

        // Calculate duration
        const durationMs = draggedEvent.end.getTime() - draggedEvent.start.getTime();
        const newEnd = new Date(newStart.getTime() + durationMs);

        const updatedAppt: Appointment = {
            ...draggedEvent.original,
            date: format(newStart, 'yyyy-MM-dd'),
            time: format(newStart, 'hh:mm a'),
            endTime: format(newEnd, 'hh:mm a'),
        };

        onAppointmentUpdate(updatedAppt);
        setDraggedEvent(null);
        setDropTarget(null);
    };

    const handleDragEnd = () => {
        setDraggedEvent(null);
        setDropTarget(null);
    };

    // ─── Header label ───────────────────────────────────────
    const headerLabel = useMemo(() => {
        if (viewMode === 'day') {
            return format(currentDate, "EEEE, d 'de' MMMM", { locale: es });
        }
        const first = visibleDays[0];
        const last = visibleDays[visibleDays.length - 1];
        if (first.getMonth() === last.getMonth()) {
            return `${format(first, 'd', { locale: es })} – ${format(last, "d 'de' MMMM yyyy", { locale: es })}`;
        }
        return `${format(first, "d MMM", { locale: es })} – ${format(last, "d MMM yyyy", { locale: es })}`;
    }, [currentDate, visibleDays, viewMode]);

    // ─── Render ─────────────────────────────────────────────
    return (
        <div className="cal-root" onDragEnd={handleDragEnd}>
            {/* ── Toolbar ── */}
            <div className="cal-toolbar">
                <div className="cal-toolbar-nav">
                    <button className="cal-nav-btn" onClick={goPrev} aria-label="Anterior">
                        <ChevronLeft size={18} />
                    </button>
                    <button className="cal-today-btn" onClick={goToday}>
                        Hoy
                    </button>
                    <button className="cal-nav-btn" onClick={goNext} aria-label="Siguiente">
                        <ChevronRight size={18} />
                    </button>
                </div>

                <h2 className="cal-toolbar-label">{headerLabel}</h2>

                <div className="cal-view-switcher">
                    <button
                        className={`cal-view-btn ${viewMode === 'day' ? 'active' : ''}`}
                        onClick={() => setViewMode('day')}
                    >
                        Día
                    </button>
                    {!isMobile && (
                        <button
                            className={`cal-view-btn ${viewMode === 'week' ? 'active' : ''}`}
                            onClick={() => setViewMode('week')}
                        >
                            Semana
                        </button>
                    )}
                    <button
                        className={`cal-view-btn ${viewMode === '3day' ? 'active' : ''}`}
                        onClick={() => setViewMode('3day')}
                    >
                        3 días
                    </button>
                </div>
            </div>

            {/* ── Day Headers ── */}
            {viewMode !== 'day' && (
                <div className="cal-day-headers" style={{ gridTemplateColumns: `48px repeat(${visibleDays.length}, 1fr)` }}>
                    <div className="cal-gutter-header" />
                    {visibleDays.map((day, i) => {
                        const isToday = isTodayFn(day);
                        return (
                            <button
                                key={i}
                                className={`cal-day-header ${isToday ? 'today' : ''}`}
                                onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                            >
                                <span className="cal-day-name">{DAY_NAMES_SHORT[day.getDay()]}</span>
                                <span className={`cal-day-number ${isToday ? 'today' : ''}`}>
                                    {format(day, 'd')}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Time Grid ── */}
            <div className="cal-scroll-container" ref={scrollRef}>
                <div className="cal-grid" style={{ gridTemplateColumns: `48px repeat(${visibleDays.length}, 1fr)` }}>
                    {/* Time gutter */}
                    <div className="cal-time-gutter">
                        {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                            const hour = START_HOUR + i;
                            const label = hour <= 12 ? `${hour} AM` : `${hour - 12} PM`;
                            return (
                                <div key={hour} className="cal-time-label" style={{ height: `${HOUR_HEIGHT}px` }}>
                                    <span>{hour === 12 ? '12 PM' : label}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Day columns */}
                    {visibleDays.map((day, dayIdx) => {
                        const dayEvents = getEventsForDay(day);
                        const isToday = isTodayFn(day);
                        const isDropHere = dropTarget?.dayIdx === dayIdx;

                        // Calculate drop ghost position
                        let ghostTop = 0;
                        let ghostHeight = 0;
                        if (isDropHere && draggedEvent && dropTarget) {
                            const ghostMinute = dropTarget.minuteOfDay;
                            ghostTop = minutesToTop(ghostMinute);
                            const durationMin = (draggedEvent.end.getTime() - draggedEvent.start.getTime()) / 60000;
                            ghostHeight = (durationMin / 60) * HOUR_HEIGHT;
                        }

                        return (
                            <div
                                key={dayIdx}
                                className={`cal-day-column ${isToday ? 'today' : ''} ${isDropHere ? 'drop-active' : ''}`}
                                onDragOver={(e) => handleDragOver(e, dayIdx)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, dayIdx)}
                            >
                                {/* Hour slots (clickable) */}
                                {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                                    const hour = START_HOUR + i;
                                    return (
                                        <div
                                            key={hour}
                                            className="cal-hour-slot"
                                            style={{ height: `${HOUR_HEIGHT}px` }}
                                            onClick={() => handleSlotClick(day, hour)}
                                        >
                                            <div className="cal-half-slot" />
                                        </div>
                                    );
                                })}

                                {/* Events with overlap layout */}
                                {(() => {
                                    const layoutMap = computeOverlapLayout(dayEvents);
                                    return dayEvents.map(event => {
                                        const layout = layoutMap.get(event.id);
                                        const overlapStyle: React.CSSProperties = layout && layout.totalColumns > 1
                                            ? {
                                                left: `calc(${(layout.column / layout.totalColumns) * 100}% + 1px)`,
                                                width: `calc(${(1 / layout.totalColumns) * 100}% - 2px)`,
                                                right: 'auto',
                                            }
                                            : {};
                                        return (
                                            <EventChip
                                                key={event.id}
                                                event={event}
                                                onClick={() => onSelectEvent(event.original)}
                                                onDragStart={(e) => handleDragStart(e, event)}
                                                isDragging={draggedEvent?.id === event.id}
                                                style={overlapStyle}
                                            />
                                        );
                                    });
                                })()}

                                {/* Drop ghost preview */}
                                {isDropHere && draggedEvent && (
                                    <DropGhost
                                        top={ghostTop}
                                        height={ghostHeight}
                                        color={draggedEvent.barberColor}
                                    />
                                )}

                                {/* Now line (only on today) */}
                                {isToday && <NowLine />}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
