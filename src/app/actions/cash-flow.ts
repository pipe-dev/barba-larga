'use server';

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    runTransaction,
    query,
    where,
    orderBy,
    limit,
} from "firebase/firestore";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import {
    subDays,
    startOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    format,
    isWithinInterval,
    isToday as isTodayDateFns
} from "date-fns";
import { es } from "date-fns/locale";
import { getServiceDetails } from "@/lib/data";
import { getServicesFromDB } from "@/app/actions/services";
import { requireAdminSession } from "@/lib/auth";

export type Transaction = {
    id: string;
    type: 'sale' | 'expense';
    amount: number;
    description: string;
    paymentMethod: 'cash' | 'card' | 'transfer';
    date: Date;
    productId?: string;
    appointmentId?: string;
};

export type FinancialSummary = {
    todayStats: { revenue: number; salesCount: number };
    thisWeekStats: { revenue: number; salesCount: number };
    thisMonthStats: { revenue: number; salesCount: number };
    last30Days: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
    };
    revenueByMethod: { method: string; total: number }[];
    chartData: { date: string; revenue: number; expenses: number }[];
};

export type Product = {
    id: string;
    name: string;
    description?: string;
    sellingPrice: number;
    stock: number;
    createdAt: Date;
};

const transactionSchema = z.object({
    type: z.enum(["sale", "expense"], { required_error: "Selecciona el tipo de transacción." }),
    paymentMethod: z.enum(["cash", "card", "transfer"], { required_error: "Selecciona un método de pago." }),
    amount: z.coerce.number().positive({ message: "El monto debe ser un número positivo." }).optional(),
    description: z.string().min(3, { message: "La descripción debe tener al menos 3 caracteres." }).optional(),
    productId: z.string().optional(),
});

const productSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
    description: z.string().optional(),
    sellingPrice: z.coerce.number().positive({ message: "El precio de venta debe ser positivo." }),
    stock: z.coerce.number().int().min(0, { message: "El stock no puede ser negativo." }),
});

const createSlug = (name: string) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

function parseSafeDate(rawDate: any): Date {
    if (!rawDate) return new Date();
    if (typeof rawDate?.toDate === 'function') {
        try {
            const d = rawDate.toDate();
            if (d instanceof Date && !isNaN(d.getTime())) return d;
        } catch {
            // fallback
        }
    }
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        return rawDate;
    }
    if (typeof rawDate === 'string' || typeof rawDate === 'number') {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}

export async function confirmAppointmentAsSale(
    appointmentId: string,
    paymentMethod: 'cash' | 'card' | 'transfer'
): Promise<{ success: boolean; message: string }> {
    if (!appointmentId || !paymentMethod) {
        return { success: false, message: "Datos inválidos." };
    }

    try {
        const dbServices = await getServicesFromDB();
        const activeServices = dbServices || [];

        await runTransaction(db, async (transaction) => {
            const appointmentRef = doc(db, "appointments", appointmentId);
            const appointmentDoc = await transaction.get(appointmentRef);

            if (!appointmentDoc.exists()) {
                throw new Error("La cita no fue encontrada.");
            }

            const appointmentData = appointmentDoc.data();

            if (appointmentData.status === 'completed') {
                throw new Error("Esta cita ya ha sido marcada como completada.");
            }

            const { names: serviceNames, totalPrice: totalAmount } = getServiceDetails(appointmentData.service, activeServices);

            if (totalAmount <= 0) {
                throw new Error("El monto del servicio es cero o inválido.");
            }

            // 1. Create the transaction document
            const saleData = {
                type: 'sale',
                amount: totalAmount,
                description: `Venta de servicios: ${serviceNames}`,
                paymentMethod,
                date: new Date(),
                appointmentId: appointmentId,
            };
            const transactionRef = doc(collection(db, "transactions"));
            transaction.set(transactionRef, saleData);

            // 2. Update the appointment status
            transaction.update(appointmentRef, { status: 'completed' });
        });

        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: "Venta confirmada y registrada con éxito." };

    } catch (error) {
        console.error("Error confirming appointment sale:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        return { success: false, message: `Error al confirmar la venta: ${errorMessage}` };
    }
}

export async function addTransaction(prevState: any, formData: FormData) {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    const validatedFields = transactionSchema.safeParse({
        type: formData.get("type"),
        paymentMethod: formData.get("paymentMethod"),
        amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
        description: formData.get("description") as string || undefined,
        productId: formData.get("productId") as string || undefined,
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Datos de formulario inválidos.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { type, paymentMethod, productId, amount, description } = validatedFields.data;

    if (type === 'sale' && !productId && !description) {
        return { success: false, message: "Para una venta manual, la descripción es obligatoria." };
    }
    if (type === 'expense' && !description) {
        return { success: false, message: "Para un gasto, la descripción es obligatoria." };
    }
    if ((type === 'expense' || (type === 'sale' && !productId)) && (!amount || amount <= 0)) {
        return { success: false, message: "El monto debe ser un número positivo para registros manuales." };
    }

    try {
        await runTransaction(db, async (transaction) => {
            let transactionData: any = {
                type,
                paymentMethod,
                date: new Date(),
            };

            if (type === 'sale' && productId && productId !== 'manual') {
                const productRef = doc(db, "products", productId);
                const productDoc = await transaction.get(productRef);

                if (!productDoc.exists()) {
                    throw new Error("El producto seleccionado no existe.");
                }

                const productData = productDoc.data();
                const currentStock = productData.stock;
                const newStock = currentStock - 1;

                if (newStock < 0) {
                    throw new Error(`No hay suficiente stock para '${productData.name}'.`);
                }

                transactionData.amount = productData.sellingPrice;
                transactionData.description = `Venta de producto: ${productData.name}`;
                transactionData.productId = productId;

                transaction.update(productRef, { stock: newStock });

            } else {
                if (!amount || !description) {
                    throw new Error("Monto y descripción son requeridos para esta transacción.");
                }
                transactionData.amount = amount;
                transactionData.description = description;
            }

            const transactionRef = doc(collection(db, "transactions"));
            transaction.set(transactionRef, transactionData);
        });

        return { success: true, message: `Transacción de '${type}' registrada con éxito.` };
    } catch (error) {
        console.error("Error adding transaction:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        return {
            success: false,
            message: `Error al registrar la transacción: ${errorMessage}`
        };
    }
}

export async function deleteTransaction(transactionId: string): Promise<{ success: boolean, message: string }> {
    if (!transactionId) {
        return { success: false, message: "ID de la transacción no es válido." };
    }

    try {
        await runTransaction(db, async (firestoreTransaction) => {
            const transactionRef = doc(db, "transactions", transactionId);
            const transactionDoc = await firestoreTransaction.get(transactionRef);

            if (!transactionDoc.exists()) {
                throw new Error("La transacción no fue encontrada.");
            }

            const transactionData = transactionDoc.data() as Transaction;

            if (transactionData.type === 'sale' && transactionData.productId) {
                const productRef = doc(db, "products", transactionData.productId);
                const productDoc = await firestoreTransaction.get(productRef);

                if (productDoc.exists()) {
                    const currentStock = productDoc.data().stock;
                    firestoreTransaction.update(productRef, { stock: currentStock + 1 });
                } else {
                    console.warn(`Attempted to restock product ${transactionData.productId} which no longer exists.`);
                }
            }

            if (transactionData.appointmentId) {
                const appointmentRef = doc(db, "appointments", transactionData.appointmentId);
                const appointmentDoc = await firestoreTransaction.get(appointmentRef);

                if (appointmentDoc.exists() && appointmentDoc.data().status === 'completed') {
                    firestoreTransaction.update(appointmentRef, { status: 'pending' });
                } else {
                    console.warn(`Attempted to revert status for appointment ${transactionData.appointmentId} which no longer exists or wasn't completed.`);
                }
            }

            firestoreTransaction.delete(transactionRef);
        });

        return { success: true, message: "Transacción eliminada con éxito. El estado y el stock han sido ajustados si fue necesario." };

    } catch (error) {
        console.error("Error deleting transaction:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error al eliminar la transacción.";
        return { success: false, message: `Error al eliminar la transacción: ${errorMessage}` };
    }
}

export async function getRecentTransactions(): Promise<Transaction[]> {
    try {
        const transactionsCol = collection(db, "transactions");
        const q = query(transactionsCol, orderBy("date", "desc"), limit(50));

        const querySnapshot = await getDocs(q);

        const transactions = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: parseSafeDate(data.date),
            } as Transaction;
        });

        return transactions;

    } catch (error) {
        console.error('Error fetching recent transactions:', error);
        return [];
    }
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
    const emptySummary: FinancialSummary = {
        todayStats: { revenue: 0, salesCount: 0 },
        thisWeekStats: { revenue: 0, salesCount: 0 },
        thisMonthStats: { revenue: 0, salesCount: 0 },
        last30Days: { totalRevenue: 0, totalExpenses: 0, netProfit: 0 },
        revenueByMethod: [],
        chartData: [],
    };

    try {
        const today = new Date();
        const thirtyDaysAgo = startOfDay(subDays(today, 29));

        const transactionsCol = collection(db, "transactions");
        const q = query(transactionsCol, where("date", ">=", thirtyDaysAgo));
        const querySnapshot = await getDocs(q);

        const transactions: Transaction[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: parseSafeDate(data.date),
            } as Transaction;
        });

        const todayStats = { revenue: 0, salesCount: 0 };
        const thisWeekStats = { revenue: 0, salesCount: 0 };
        const thisMonthStats = { revenue: 0, salesCount: 0 };

        let last30DaysRevenue = 0;
        let last30DaysExpenses = 0;

        const revenueByMethod: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
        const dailyData: Record<string, { revenue: number, expenses: number }> = {};

        for (let i = 0; i < 30; i++) {
            const date = subDays(today, i);
            const formattedDate = format(date, "d MMM", { locale: es });
            dailyData[formattedDate] = { revenue: 0, expenses: 0 };
        }

        const weekInterval = { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
        const monthInterval = { start: startOfMonth(today), end: endOfMonth(today) };

        transactions.forEach(tx => {
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'sale') {
                if (isTodayDateFns(tx.date)) {
                    todayStats.revenue += amt;
                    todayStats.salesCount += 1;
                }
                if (isWithinInterval(tx.date, weekInterval)) {
                    thisWeekStats.revenue += amt;
                    thisWeekStats.salesCount += 1;
                }
                if (isWithinInterval(tx.date, monthInterval)) {
                    thisMonthStats.revenue += amt;
                    thisMonthStats.salesCount += 1;
                }
            }

            if (tx.type === 'sale') {
                last30DaysRevenue += amt;
                const method = tx.paymentMethod || 'cash';
                revenueByMethod[method] = (revenueByMethod[method] || 0) + amt;
            } else {
                last30DaysExpenses += amt;
            }

            const formattedDate = format(tx.date, "d MMM", { locale: es });
            if (dailyData[formattedDate]) {
                if (tx.type === 'sale') {
                    dailyData[formattedDate].revenue += amt;
                } else {
                    dailyData[formattedDate].expenses += amt;
                }
            }
        });

        const chartData = Object.keys(dailyData).map(date => ({
            date,
            revenue: dailyData[date].revenue,
            expenses: dailyData[date].expenses,
        })).reverse();

        return {
            todayStats,
            thisWeekStats,
            thisMonthStats,
            last30Days: {
                totalRevenue: last30DaysRevenue,
                totalExpenses: last30DaysExpenses,
                netProfit: last30DaysRevenue - last30DaysExpenses,
            },
            revenueByMethod: Object.entries(revenueByMethod).map(([method, total]) => ({ method, total })),
            chartData,
        };

    } catch (error) {
        console.error('Error fetching financial summary:', error);
        return emptySummary;
    }
}

export async function addProduct(prevState: any, formData: FormData) {
    const validatedFields = productSchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
        sellingPrice: formData.get("sellingPrice"),
        stock: formData.get("stock"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores en el formulario.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const { name, ...rest } = validatedFields.data;
        const productId = createSlug(name);

        const productRef = doc(db, "products", productId);
        const productDoc = await getDoc(productRef);

        if (productDoc.exists()) {
            return {
                success: false,
                message: `Un producto con el nombre '${name}' ya existe. Por favor, elige un nombre diferente.`
            };
        }

        const productData = {
            name,
            ...rest,
            createdAt: new Date(),
        };

        await setDoc(productRef, productData);

        return { success: true, message: `Producto '${name}' añadido con éxito.` };
    } catch (error) {
        console.error("Error adding product:", error);
        return {
            success: false,
            message: "Ocurrió un error al añadir el producto."
        };
    }
}

export async function updateProduct(prevState: any, formData: FormData) {
    const validatedFields = productSchema.safeParse({
        id: formData.get("id"),
        name: formData.get("name"),
        description: formData.get("description"),
        sellingPrice: formData.get("sellingPrice"),
        stock: formData.get("stock"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    const { id, ...productData } = validatedFields.data;

    if (!id) {
        return { success: false, message: "ID del producto no encontrado." };
    }

    try {
        const productRef = doc(db, "products", id);
        await updateDoc(productRef, productData);
        return { success: true, message: "Producto actualizado con éxito." };
    } catch (error) {
        console.error("Error updating product:", error);
        return { success: false, message: "No se pudo actualizar el producto." };
    }
}

export async function deleteProduct(productId: string): Promise<{ success: boolean, message: string }> {
    if (!productId) {
        return { success: false, message: "ID del producto no es válido." };
    }
    try {
        await deleteDoc(doc(db, "products", productId));
        return { success: true, message: "Producto eliminado con éxito." };
    } catch (error) {
        console.error("Error deleting product:", error);
        return { success: false, message: "Ocurrió un error al eliminar el producto." };
    }
}

export async function getProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "products");
        const q = query(productsCol, orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);

        const products = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: parseSafeDate(data.createdAt),
            } as Product;
        });

        return products;

    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}
