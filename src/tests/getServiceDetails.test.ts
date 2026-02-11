import { describe, it, expect } from 'vitest';
import { getServiceDetails } from '@/lib/data';

describe('getServiceDetails', () => {
    it('should return correct name and price for a single service', () => {
        const result = getServiceDetails('haircut');
        expect(result.names).toBe('Corte de cabello');
        expect(result.totalPrice).toBe(25000);
    });

    it('should return correct names and total price for multiple services', () => {
        const result = getServiceDetails('haircut,eyebrows');
        expect(result.names).toContain('Corte de cabello');
        expect(result.names).toContain('Cejas con cuchilla');
        expect(result.totalPrice).toBe(25000 + 4000);
    });

    it('should return "Servicio Desconocido" for empty input', () => {
        const result = getServiceDetails('');
        expect(result.names).toBe('Servicio Desconocido');
        expect(result.totalPrice).toBe(0);
    });

    it('should return empty names and 0 total for unknown service IDs', () => {
        const result = getServiceDetails('unknown-service');
        expect(result.names).toBe('');
        expect(result.totalPrice).toBe(0);
    });

    it('should correctly sum prices for combo service', () => {
        const result = getServiceDetails('haircut-beard');
        expect(result.names).toBe('Corte de cabello con Barba');
        expect(result.totalPrice).toBe(35000);
    });
});
