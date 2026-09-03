import { describe, it, expect } from 'vitest';
import type { TeamMember } from '@/app/actions';

/**
 * Tests for the barber color and name resolution logic used in 
 * AppointmentCalendar's eventStyleGetter and event mapping.
 * 
 * This replicates the core logic without needing to render the full calendar component.
 */

const mockTeam: TeamMember[] = [
    {
        id: 'alan-martinez',
        name: 'Alan Martinez',
        email: 'alan@barbalarga.com',
        role: 'Barbero',
        description: 'Barbero principal',
        imageUrl: 'https://i.ibb.co/XZHYyLFY/nuestro-equipo-alan.webp',
        isAvailable: true,
        color: '#2563eb', // Blue
    },
    {
        id: 'new-barber',
        name: 'Carlos Pérez',
        email: 'carlos@barbalarga.com',
        role: 'Barbero',
        description: 'Nuevo barbero',
        imageUrl: 'https://i.ibb.co/k2TL19sp/logo-barber.jpg',
        isAvailable: true,
        color: '#e11d48', // Rose
    },
];

// Replicate the eventStyleGetter logic
function getEventStyle(event: { barberId: string; type?: string; status?: string }, team: TeamMember[]) {
    const barber = team.find(t => t.id === event.barberId);
    const backgroundColor = barber?.color || '#3174ad';

    let style: Record<string, any> = {
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

    return { style };
}

// Replicate barber name resolution logic
function resolveBarberName(barberId: string, team: TeamMember[]): string {
    const barber = team.find(b => b.id === barberId);
    return barber ? barber.name : 'Desconocido';
}

describe('Barber Color Logic (eventStyleGetter)', () => {
    it('should return Alan\'s blue color for his appointments', () => {
        const result = getEventStyle({ barberId: 'alan-martinez' }, mockTeam);
        expect(result.style.backgroundColor).toBe('#2563eb');
    });

    it('should return Carlos\'s rose color for his appointments', () => {
        const result = getEventStyle({ barberId: 'new-barber' }, mockTeam);
        expect(result.style.backgroundColor).toBe('#e11d48');
    });

    it('should return default color for unknown barber', () => {
        const result = getEventStyle({ barberId: 'unknown-barber' }, mockTeam);
        expect(result.style.backgroundColor).toBe('#3174ad');
    });

    it('should override with gray for blocked time slots', () => {
        const result = getEventStyle({ barberId: 'alan-martinez', type: 'blocked' }, mockTeam);
        expect(result.style.backgroundColor).toBe('#6c757d');
        expect(result.style.opacity).toBe(1);
    });

    it('should override with green for completed appointments', () => {
        const result = getEventStyle({ barberId: 'alan-martinez', status: 'completed' }, mockTeam);
        expect(result.style.backgroundColor).toBe('#198754');
    });

    it('should ensure each barber has a unique color', () => {
        const colors = mockTeam.map(t => t.color);
        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBe(colors.length);
    });
});

describe('Barber Name Resolution', () => {
    it('should return correct name for Alan', () => {
        expect(resolveBarberName('alan-martinez', mockTeam)).toBe('Alan Martinez');
    });

    it('should return correct name for Carlos', () => {
        expect(resolveBarberName('new-barber', mockTeam)).toBe('Carlos Pérez');
    });

    it('should return "Desconocido" for unknown barber ID', () => {
        expect(resolveBarberName('nobody', mockTeam)).toBe('Desconocido');
    });
});
