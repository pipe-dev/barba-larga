import { describe, it, expect } from 'vitest';
import { getServiceDetails, type Service } from '@/lib/data';

const mockServices: Service[] = [
    {
        id: "haircut",
        name: "Corte de cabello",
        description: "Corte",
        price: "25000",
        duration: 60,
        mediaUrl: "",
        mediaType: "image"
    },
    {
        id: "eyebrows",
        name: "Cejas con cuchilla",
        description: "Cejas",
        price: "4000",
        duration: 20,
        mediaUrl: "",
        mediaType: "image"
    },
    {
        id: "haircut-beard",
        name: "Corte de cabello con Barba",
        description: "Corte y barba",
        price: "35000",
        duration: 90,
        mediaUrl: "",
        mediaType: "image"
    }
];

describe('getServiceDetails', () => {
    it('should return correct name and price for a single service', () => {
        const result = getServiceDetails('haircut', mockServices);
        expect(result.names).toBe('Corte de cabello');
        expect(result.totalPrice).toBe(25000);
    });

    it('should return correct names and total price for multiple services', () => {
        const result = getServiceDetails('haircut,eyebrows', mockServices);
        expect(result.names).toContain('Corte de cabello');
        expect(result.names).toContain('Cejas con cuchilla');
        expect(result.totalPrice).toBe(25000 + 4000);
    });

    it('should return default for empty input', () => {
        const result = getServiceDetails('', mockServices);
        expect(result.names).toBe('Servicio');
        expect(result.totalPrice).toBe(0);
    });

    it('should return service ID for unknown service IDs', () => {
        const result = getServiceDetails('unknown-service', mockServices);
        expect(result.names).toBe('unknown-service');
        expect(result.totalPrice).toBe(0);
    });

    it('should correctly sum prices for combo service', () => {
        const result = getServiceDetails('haircut-beard', mockServices);
        expect(result.names).toBe('Corte de cabello con Barba');
        expect(result.totalPrice).toBe(35000);
    });
});
