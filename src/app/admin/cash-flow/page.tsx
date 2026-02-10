'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, BarChart, Package, Receipt, PlusCircle, Loader2, TrendingUp, TrendingDown, CreditCard, Smartphone, DollarSign as MoneyIcon, Banknote, Landmark, Warehouse, ShoppingCart, Trash2, Pencil, AlertCircle, Calendar, History, ShoppingBag, Users, Star, Repeat, UserX, ConciergeBell, MoreVertical, Briefcase, UserPlus, Mail, ChevronDown, CheckSquare, X, Phone, MessageCircle, Bell, Download, Users2 } from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart as RechartsBarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import Image from 'next/image';

import { addTransaction, getRecentTransactions, getFinancialSummary, addProduct, getProducts, deleteTransaction, deleteProduct, updateProduct, getCustomerAnalytics, addCustomer, deleteCustomers, getTeam } from '@/app/actions';
import type { Transaction, FinancialSummary, Product, CustomerAnalytics, TeamMember } from '@/app/actions';
import { services as allServices, Service } from '@/lib/data';
import { useToast } from "@/hooks/use-toast";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider, Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Explicitly define headers and their order
  const headers = Object.keys(data[0]);
  const formattedHeaders = headers.map(header =>
    header.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
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


function DashboardTab({ summary }: { summary: FinancialSummary | null }) {

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Cargando resumen de ventas, gastos y flujo de caja.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (value: number) => `$${value.toLocaleString('es-CO')}`;

  const paymentMethodLabels: { [key: string]: string } = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transf.',
  };

  const revenueByMethodChartData = summary.revenueByMethod.map(item => ({
    method: paymentMethodLabels[item.method] || item.method,
    total: item.total,
  }));

  const chartConfig = {
    total: {
      label: "Total",
      color: "hsl(var(--chart-1))",
    },
    revenue: {
      label: "Ingresos",
      color: "hsl(var(--chart-2))",
    },
    expenses: {
      label: "Gastos",
      color: "hsl(var(--chart-5))",
    },
  } satisfies ChartConfig;


  return (
    <div className="grid gap-6">
      {/* Time-based stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas de Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(summary.todayStats.revenue)}</div>
            <p className="text-xs text-muted-foreground">{summary.todayStats.salesCount} venta(s) hoy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas de la Semana</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.thisWeekStats.revenue)}</div>
            <p className="text-xs text-muted-foreground">{summary.thisWeekStats.salesCount} venta(s) esta semana</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.thisMonthStats.revenue)}</div>
            <p className="text-xs text-muted-foreground">{summary.thisMonthStats.salesCount} venta(s) este mes</p>
          </CardContent>
        </Card>
      </div>
      <Separator />
      {/* 30-day summary */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos (Últimos 30 días)</CardTitle>
            <MoneyIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.last30Days.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Total de ingresos en el período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos (Últimos 30 días)</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.last30Days.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">Total de gastos en el período</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Neta (Últimos 30 días)</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.last30Days.netProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(summary.last30Days.netProfit)}</div>
            <p className="text-xs text-muted-foreground">Ingresos - Gastos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Rendimiento en los Últimos 30 Días</CardTitle>
          </CardHeader>
          <CardContent className="pl-2 pr-4 sm:pr-2">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart
                accessibilityLayer
                data={summary.chartData}
                margin={{
                  left: 0,
                  right: 16,
                  top: 5,
                  bottom: 5,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.substring(0, 3)}
                  interval={4}
                />
                <YAxis
                  tickFormatter={(value) => `$${Number(value) / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div>
                          <p className="font-medium">{formatCurrency(value as number)}</p>
                          <p className="text-sm text-muted-foreground">{name === 'revenue' ? 'Ingresos' : 'Gastos'}</p>
                        </div>
                      )}
                      indicator="line"
                    />
                  }
                />
                <Line dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
                <Line dataKey="expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ingresos por Método de Pago</CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 pr-4 sm:pr-2">
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <RechartsBarChart accessibilityLayer data={revenueByMethodChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="method"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" formatter={(value) => formatCurrency(value as number)} />}
                />
                <Bar dataKey="total" fill="var(--color-total)" radius={8} />
              </RechartsBarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const transactionFormSchema = z.object({
  type: z.enum(["sale", "expense"]),
  paymentMethod: z.enum(["cash", "card", "transfer"]),
  productId: z.string().optional(),
  description: z.string().optional(),
  amount: z.coerce.number().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;
const initialFormState = { message: "", errors: {}, success: false };


function SubmitButton({ label, icon: Icon = PlusCircle }: { label: string, icon?: React.ElementType }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}

function SaleForm({ products, services, onFormSubmit }: { products: Product[], services: Service[], onFormSubmit: () => void }) {
  const [state, formAction] = useActionState(addTransaction, initialFormState);
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [selectedProductId, setSelectedProductId] = React.useState('manual');

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "sale",
      paymentMethod: "cash",
      productId: "manual",
      description: "",
      amount: 0,
    },
  });

  React.useEffect(() => {
    if (state.success) {
      toast({ title: "Éxito", description: state.message });
      form.reset();
      formRef.current?.reset();
      setSelectedProductId('manual');
      onFormSubmit();
    } else if (state.message && !state.success) {
      toast({ title: "Error", description: state.message, variant: "destructive" });
    }
  }, [state, toast, form, onFormSubmit]);

  const isManualSale = selectedProductId === 'manual';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Venta / Ingreso</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            ref={formRef}
            action={formAction}
            className="space-y-6"
          >
            <input type="hidden" name="type" value="sale" />

            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Venta</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedProductId(value);
                    }}
                    value={field.value}
                    name="productId"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo de venta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">-- Venta Manual / Servicio --</SelectItem>
                      {products.filter(p => p.stock > 0).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.stock} disp.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isManualSale && (
              <>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <div>
                          <Input placeholder="Ej: Corte de caballero" {...field} name={field.name} list="service-suggestions" />
                          <datalist id="service-suggestions">
                            {services.map(service => (
                              <option key={service.id} value={service.name} />
                            ))}
                          </datalist>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 20000" {...field} name={field.name} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pago</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} name={field.name}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton label="Registrar Venta" icon={TrendingUp} />
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}


function ExpenseForm({ onFormSubmit }: { onFormSubmit: () => void }) {
  const [state, formAction] = useActionState(addTransaction, initialFormState);
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "expense",
      amount: 0,
      description: "",
      paymentMethod: "cash",
    },
  });

  React.useEffect(() => {
    if (state.success) {
      toast({ title: "Éxito", description: state.message });
      form.reset();
      formRef.current?.reset();
      onFormSubmit();
    } else if (state.message && !state.success) {
      toast({ title: "Error", description: state.message, variant: "destructive" });
    }
  }, [state, toast, form, onFormSubmit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Gasto</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            ref={formRef}
            action={formAction}
            className="space-y-6"
          >
            <input type="hidden" name="type" value="expense" />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Arriendo del local" {...field} name="description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ej: 500000" {...field} name="amount" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pago</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} name="paymentMethod">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SubmitButton label="Registrar Gasto" icon={TrendingDown} />
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

const customerFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
  phone: z.string().optional(),
});
type CustomerFormData = z.infer<typeof customerFormSchema>;

function AddCustomerForm({ onFormSubmit }: { onFormSubmit: () => void }) {
  const [state, formAction] = useActionState(addCustomer, { success: false, message: "", errors: {} });
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  React.useEffect(() => {
    if (state.success) {
      toast({ title: "Éxito", description: state.message });
      form.reset();
      formRef.current?.reset();
      onFormSubmit();
    } else if (state.message && !state.success) {
      toast({ title: "Error", description: state.message, variant: "destructive" });
    }
  }, [state, toast, form, onFormSubmit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Añadir Cliente Manualmente</CardTitle>
        <CardDescription>Usa este formulario para añadir clientes que no han agendado por la app.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            ref={formRef}
            action={formAction}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="ej: Daniel PF" {...field} name="name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Ej: john.doe@email.com" {...field} name="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono (Opcional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Ej: 3001234567" {...field} name="phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <SubmitButton label="Añadir Cliente" icon={UserPlus} />
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function NewTransactionTab({ products, services, onDataChange }: { products: Product[], services: Service[], onDataChange: () => void }) {
  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      <div className="space-y-8">
        <SaleForm products={products} services={services} onFormSubmit={onDataChange} />
        <ExpenseForm onFormSubmit={onDataChange} />
      </div>
      <AddCustomerForm onFormSubmit={onDataChange} />
    </div>
  )
}


function TransactionsTab({ initialTransactions, onDataChange }: { initialTransactions: Transaction[], onDataChange: () => void }) {
  const [transactions, setTransactions] = React.useState(initialTransactions);
  const { toast } = useToast();

  React.useEffect(() => {
    setTransactions(initialTransactions);
  }, [initialTransactions]);

  const handleDeleteTransaction = async (id: string) => {
    const { success, message } = await deleteTransaction(id);
    if (success) {
      toast({ title: "Éxito", description: message });
      onDataChange();
    } else {
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleExport = () => {
    const dataToExport = transactions.map(tx => ({
      id_transaccion: tx.id,
      tipo: tx.type === 'sale' ? 'Venta' : 'Gasto',
      descripcion: tx.description,
      monto: tx.amount,
      metodo_pago: tx.paymentMethod,
      fecha: tx.date,
      id_producto: tx.productId || 'N/A',
      id_cita: tx.appointmentId || 'N/A',
    }));
    downloadCSV(dataToExport, `transacciones-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const paymentMethodIcons = {
    cash: <MoneyIcon className="h-4 w-4" />,
    card: <CreditCard className="h-4 w-4" />,
    transfer: <Smartphone className="h-4 w-4" />,
  };

  const paymentMethodLabels = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle>Transacciones Recientes</CardTitle>
          <CardDescription>
            Lista de los últimos movimientos registrados.
          </CardDescription>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" disabled={transactions.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar a CSV
        </Button>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="space-y-4 md:hidden">
              {transactions.map((tx) => (
                <Card key={tx.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {tx.type === 'sale' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                          {tx.description}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {format(new Date(tx.date), "d MMM, h:mm a", { locale: es })}
                        </Badge>
                      </div>
                      <p className={`font-semibold text-lg ${tx.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'expense' && '-'}
                        ${tx.amount.toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        {paymentMethodIcons[tx.paymentMethod]}
                        {paymentMethodLabels[tx.paymentMethod]}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará la transacción permanentemente y si era una venta de producto o servicio, el stock o estado de la cita se restaurará.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)}>
                              Sí, eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Desktop Table View */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {tx.type === 'sale' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                      {tx.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {format(new Date(tx.date), "d MMM, h:mm a", { locale: es })}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        {paymentMethodIcons[tx.paymentMethod]}
                        {paymentMethodLabels[tx.paymentMethod]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${tx.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'expense' && '-'}
                      ${tx.amount.toLocaleString('es-CO')}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará la transacción permanentemente y si era una venta de producto o servicio, el stock o estado de la cita se restaurará.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTransaction(tx.id)}>
                              Sí, eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
            <p className="text-muted-foreground">No hay transacciones todavía.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


const productFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  description: z.string().optional(),
  sellingPrice: z.coerce.number().positive({ message: "El precio de venta debe ser positivo." }),
  stock: z.coerce.number().int().min(0, { message: "El stock no puede ser negativo." }),
});

type ProductFormData = z.infer<typeof productFormSchema>;
const initialProductFormState = { message: "", errors: {}, success: false };

function EditSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label}
    </Button>
  )
}

function EditProductForm({ product, onFormSubmit, onOpenChange }: { product: Product, onFormSubmit: () => void, onOpenChange: (open: boolean) => void }) {
  const [state, formAction] = useActionState(updateProduct, initialProductFormState);
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { ...product },
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
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem> <FormLabel>Nombre</FormLabel> <FormControl><Input {...field} name="name" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="description" render={({ field }) => (<FormItem> <FormLabel>Descripción</FormLabel> <FormControl><Textarea {...field} name="description" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="sellingPrice" render={({ field }) => (<FormItem> <FormLabel>Precio Venta</FormLabel> <FormControl><Input type="number" {...field} name="sellingPrice" /></FormControl> <FormMessage /> </FormItem>)} />
        <FormField control={form.control} name="stock" render={({ field }) => (<FormItem> <FormLabel>Stock</FormLabel> <FormControl><Input type="number" {...field} name="stock" /></FormControl> <FormMessage /> </FormItem>)} />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
          <EditSubmitButton label="Guardar Cambios" />
        </DialogFooter>
      </form>
    </Form>
  )
}

function InventoryTab({ initialProducts, onDataChange }: { initialProducts: Product[], onDataChange: () => void }) {
  const [state, formAction] = useActionState(addProduct, initialProductFormState);
  const [products, setProducts] = React.useState(initialProducts);
  const { toast } = useToast();
  const [openDialogs, setOpenDialogs] = React.useState<Record<string, boolean>>({});
  const formRef = React.useRef<HTMLFormElement>(null);


  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sellingPrice: 0,
      stock: 0,
    },
  });

  const formatCurrency = (value: number) => `$${value.toLocaleString('es-CO')}`;


  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  React.useEffect(() => {
    if (state.success) {
      toast({ title: "Éxito", description: state.message });
      form.reset();
      formRef.current?.reset();
      onDataChange();
    } else if (state.message && !state.success) {
      toast({ title: "Error", description: state.message, variant: "destructive" });
    }
  }, [state, toast, form, onDataChange]);

  const handleDeleteProduct = async (id: string) => {
    const { success, message } = await deleteProduct(id);
    if (success) {
      toast({ title: "Éxito", description: message });
      onDataChange(); // Refresh all data
    } else {
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const setDialogOpen = (productId: string, open: boolean) => {
    setOpenDialogs(prev => ({ ...prev, [productId]: open }))
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Añadir Producto</CardTitle>
            <CardDescription>
              Agrega un nuevo artículo a tu inventario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                ref={formRef}
                action={formAction}
                className="space-y-6"
              >
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem> <FormLabel>Nombre del Producto</FormLabel> <FormControl><Input placeholder="Ej: Cera para el cabello" {...field} name="name" /></FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem> <FormLabel>Descripción (Opcional)</FormLabel> <FormControl><Textarea placeholder="Ej: Fijación fuerte, acabado mate" {...field} name="description" /></FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="sellingPrice" render={({ field }) => (<FormItem> <FormLabel>Precio de Venta</FormLabel> <FormControl><Input type="number" placeholder="Ej: 35000" {...field} name="sellingPrice" /></FormControl> <FormMessage /> </FormItem>)} />
                <FormField control={form.control} name="stock" render={({ field }) => (<FormItem> <FormLabel>Cantidad en Stock</FormLabel> <FormControl><Input type="number" placeholder="Ej: 10" {...field} name="stock" /></FormControl> <FormMessage /> </FormItem>)} />
                <SubmitButton label="Añadir Producto" />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventario Actual</CardTitle>
            <CardDescription>
              Lista de todos los productos disponibles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length > 0 ? (
              <>
                {/* Mobile Card View */}
                <div className="space-y-4 md:hidden">
                  {products.map((prod) => (
                    <Card key={prod.id} className="overflow-hidden">
                      <CardContent className="p-4 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">{prod.name}</p>
                            <p className="text-xs text-muted-foreground">{prod.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-lg text-primary">{formatCurrency(prod.sellingPrice)}</p>
                            <Badge variant={prod.stock > 5 ? "default" : prod.stock > 0 ? "secondary" : "destructive"}>
                              {prod.stock <= 5 && prod.stock > 0 && <AlertCircle className="mr-1 h-3 w-3" />}
                              {prod.stock} unidades
                            </Badge>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end items-center pt-3 border-t">
                          <Dialog open={openDialogs[prod.id] || false} onOpenChange={(open) => setDialogOpen(prod.id, open)}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Producto</DialogTitle>
                                <DialogDescription>Realiza cambios a este producto en tu inventario.</DialogDescription>
                              </DialogHeader>
                              <EditProductForm product={prod} onFormSubmit={onDataChange} onOpenChange={(open) => setDialogOpen(prod.id, open)} />
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro de eliminar este producto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará el producto permanentemente. Las transacciones pasadas no se verán afectadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProduct(prod.id)}>Sí, eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop Table View */}
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((prod) => (
                      <TableRow key={prod.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-md">
                              <Warehouse className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              {prod.name}
                              {prod.description && <p className="text-xs text-muted-foreground">{prod.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={prod.stock > 5 ? "default" : prod.stock > 0 ? "secondary" : "destructive"}>
                            {prod.stock <= 5 && prod.stock > 0 && <AlertCircle className="mr-1 h-3 w-3" />}
                            {prod.stock} unidades
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(prod.sellingPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={openDialogs[prod.id] || false} onOpenChange={(open) => setDialogOpen(prod.id, open)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Editar Producto</DialogTitle>
                                <DialogDescription>Realiza cambios a este producto en tu inventario.</DialogDescription>
                              </DialogHeader>
                              <EditProductForm product={prod} onFormSubmit={onDataChange} onOpenChange={(open) => setDialogOpen(prod.id, open)} />
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro de eliminar este producto?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará el producto permanentemente. Las transacciones pasadas no se verán afectadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProduct(prod.id)}>Sí, eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
                <p className="text-muted-foreground">No hay productos en el inventario.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CustomersTab({ initialCustomers, isLoading, team, onDataChange }: { initialCustomers: CustomerAnalytics[], isLoading: boolean, team: TeamMember[], onDataChange: () => void }) {
  const formatCurrency = (value: number) => `$${value.toLocaleString('es-CO')}`;
  const { toast } = useToast();
  const [selectedCustomers, setSelectedCustomers] = React.useState<string[]>([]);
  const isAllSelected = initialCustomers.length > 0 && selectedCustomers.length === initialCustomers.length;

  const statusConfig = {
    stable: {
      label: 'Estable',
      icon: Star,
      color: 'bg-green-500',
      description: 'Clientes leales con visitas regulares.',
    },
    new: {
      label: 'Nuevo',
      icon: Users,
      color: 'bg-blue-500',
      description: 'Clientes recientes, con potencial de fidelización.',
    },
    irregular: {
      label: 'Irregular',
      icon: Repeat,
      color: 'bg-yellow-500',
      description: 'Clientes que no han visitado en un tiempo, buen momento para un recordatorio.',
    },
    at_risk: {
      label: 'En Riesgo',
      icon: UserX,
      color: 'bg-red-500',
      description: 'Clientes que no han visitado en mucho tiempo, posiblemente perdidos.',
    },
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedCustomers(checked ? initialCustomers.map(c => c.id) : []);
  };

  const handleSelectCustomer = (id: string, checked: boolean) => {
    setSelectedCustomers(prev => checked ? [...prev, id] : prev.filter(email => email !== id));
  };

  const handleDeleteSelected = async () => {
    const { success, message } = await deleteCustomers(selectedCustomers);
    if (success) {
      toast({ title: 'Éxito', description: message });
      setSelectedCustomers([]);
      onDataChange();
    } else {
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const dataToExport = initialCustomers.map(c => ({
      nombre_cliente: c.name,
      email: c.email,
      telefono: c.phone || 'N/A',
      visitas_totales: c.totalVisits,
      gasto_total: c.totalSpent,
      estado_cliente: statusConfig[c.status].label,
      ultima_visita: c.lastVisitDate ? format(c.lastVisitDate, 'yyyy-MM-dd') : 'N/A'
    }));
    downloadCSV(dataToExport, `clientes-${new Date().toISOString().split('T')[0]}.csv`);
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Clientes</CardTitle>
          <CardDescription>Cargando datos de clientes...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-md border-2 border-dashed">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>Análisis de Clientes</CardTitle>
            <CardDescription>
              Haz clic en un cliente para ver su historial y análisis detallado.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" size="sm" disabled={initialCustomers.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar a CSV
            </Button>
            {selectedCustomers.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar ({selectedCustomers.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de eliminar a los clientes seleccionados?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminarán permanentemente {selectedCustomers.length} cliente(s) de la base de datos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelected}>Sí, eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {initialCustomers.length > 0 ? (
          <div className="w-full space-y-4">
            <div className="flex items-center p-4 border-b">
              <Checkbox
                id="select-all"
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Seleccionar todos los clientes"
                className="mr-4"
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Seleccionar todos ({initialCustomers.length})
              </Label>
            </div>
            {initialCustomers.map((customer) => {
              const config = statusConfig[customer.status];
              return (
                <Collapsible key={customer.id} asChild>
                  <Card className="overflow-hidden">
                    <div className="flex items-center p-4">
                      <Checkbox
                        id={`select-${customer.id}`}
                        checked={selectedCustomers.includes(customer.id)}
                        onCheckedChange={(checked) => handleSelectCustomer(customer.id, !!checked)}
                        aria-label={`Seleccionar ${customer.name}`}
                        className="mr-4"
                      />
                      <CollapsibleTrigger className="w-full text-left cursor-pointer flex items-center justify-between">
                        <div className="flex flex-col md:flex-row md:items-center md:gap-4 flex-1">
                          <div className="flex-1">
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                          </div>
                          <div className="flex items-center gap-4 mt-2 md:mt-0">
                            <TooltipProvider>
                              <UiTooltip>
                                <UiTooltipTrigger asChild>
                                  <div className="w-fit">
                                    <Badge className={`bg-opacity-20 text-opacity-90 border-0 ${config.color.replace('bg-', 'text-').replace('-500', '-900 dark:text-').replace('-900', '-100')} ${config.color.replace('bg-', 'dark:bg-opacity-20 dark:bg-')}`}>
                                      <span className={`mr-2 h-2 w-2 rounded-full ${config.color}`}></span>
                                      {config.label}
                                    </Badge>
                                  </div>
                                </UiTooltipTrigger>
                                <UiTooltipContent>
                                  <p>{config.description}</p>
                                </UiTooltipContent>
                              </UiTooltip>
                            </TooltipProvider>
                            <div className="hidden sm:block text-center">
                              <p className="text-xs text-muted-foreground">Visitas</p>
                              <p className="font-medium">{customer.totalVisits}</p>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180 ml-4 shrink-0" />
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="p-4 md:p-6 bg-muted/30 border-t">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 text-center">
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Gasto Total</CardTitle></CardHeader>
                            <CardContent><p className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</p></CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Visitas Totales</CardTitle></CardHeader>
                            <CardContent><p className="text-2xl font-bold">{customer.totalVisits}</p></CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Última Visita</CardTitle></CardHeader>
                            <CardContent>
                              <p className="text-xl font-bold">
                                {customer.lastVisitDate ? format(customer.lastVisitDate, "d MMM yyyy", { locale: es }) : 'N/A'}
                              </p>
                              <p className="text-sm text-muted-foreground">{customer.lastVisitTime ?? ''}</p>
                            </CardContent>
                          </Card>
                        </div>

                        {customer.phone && (
                          <div className="mb-6 p-4 border rounded-lg bg-background">
                            <h4 className="font-semibold mb-2">Contacto Directo</h4>
                            <div className="flex items-center justify-between">
                              <p className="text-muted-foreground">{customer.phone}</p>
                              <div className="flex gap-2">
                                <Button asChild variant="outline" size="sm">
                                  <a href={`tel:+57${customer.phone}`}>
                                    <Phone className="mr-2 h-4 w-4" /> Llamar
                                  </a>
                                </Button>
                                <Button asChild variant="outline" size="sm">
                                  <a href={`https://wa.me/57${customer.phone}`} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        <h4 className="font-semibold mb-2">Historial de Citas</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fecha y Hora</TableHead>
                                <TableHead>Servicios</TableHead>
                                <TableHead>Barbero</TableHead>
                                <TableHead className="text-right">Costo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {customer.appointments.map((apt, index) => {
                                const isLastCompletedVisit = customer.lastVisitDate ? apt.date === format(customer.lastVisitDate, 'yyyy-MM-dd') && apt.time === customer.lastVisitTime : false;
                                const isPending = apt.status === 'pending';
                                const appointmentDate = parseISO(apt.date);
                                const missedAppointment = isPending && isPast(new Date(appointmentDate.setHours(23, 59, 59, 999)));

                                return (
                                  <TableRow
                                    key={index}
                                    className={cn(
                                      isLastCompletedVisit && 'bg-primary/10',
                                      (isPending || missedAppointment) && 'text-muted-foreground/80'
                                    )}
                                  >
                                    <TableCell>
                                      <div className='flex flex-col'>
                                        <span>{format(appointmentDate, "dd/MM/yy", { locale: es })} - {apt.time}</span>
                                        {isLastCompletedVisit ? (
                                          <Badge className='w-fit mt-1' variant="secondary"><CheckSquare className="mr-1 h-3 w-3" />Última Visita</Badge>
                                        ) : missedAppointment ? (
                                          <Badge className='w-fit mt-1' variant="destructive"><X className="mr-1 h-3 w-3" />Ausente</Badge>
                                        ) : isPending ? (
                                          <Badge className='w-fit mt-1' variant="outline">Pendiente</Badge>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell>{apt.serviceNames}</TableCell>
                                    <TableCell>{team.find(t => t.id === apt.barberId)?.name || 'N/A'}</TableCell>
                                    <TableCell className="text-right">{apt.status === 'completed' ? formatCurrency(apt.cost) : 'N/A'}</TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })}
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-md border-2 border-dashed">
            <p className="text-muted-foreground">No hay suficientes datos de citas para analizar.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function CashFlowPage() {
  const [initialTransactions, setInitialTransactions] = React.useState<Transaction[]>([]);
  const [initialProducts, setInitialProducts] = React.useState<Product[]>([]);
  const [initialServices, setInitialServices] = React.useState<Service[]>([]);
  const [initialCustomers, setInitialCustomers] = React.useState<CustomerAnalytics[]>([]);
  const [initialTeam, setInitialTeam] = React.useState<TeamMember[]>([]);
  const [summary, setSummary] = React.useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentTab, setCurrentTab] = React.useState("dashboard");
  const { toast } = useToast();

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [transactions, summaryData, products, customers, team] = await Promise.all([
        getRecentTransactions(),
        getFinancialSummary(),
        getProducts(),
        getCustomerAnalytics(),
        getTeam(),
      ]);
      setInitialTransactions(transactions);
      setSummary(summaryData);
      setInitialProducts(products);
      setInitialServices(allServices);
      setInitialCustomers(customers);
      setInitialTeam(team);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  React.useEffect(() => {
    const sessionAuth = sessionStorage.getItem('isAdminAuthenticated');
    if (sessionAuth !== 'true') {
      window.location.href = '/admin';
      return;
    }

    fetchData();

  }, [fetchData]);

  if (isLoading && !initialTeam.length) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" className="mb-2" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Citas
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Sistema de Caja</h1>
          <p className="text-muted-foreground">
            Gestiona las finanzas, el inventario y los clientes de tu barbería.
          </p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto md:h-10">
          <TabsTrigger value="dashboard" className="sm:flex-row flex-col gap-1">
            <BarChart className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="register" className="sm:flex-row flex-col gap-1">
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar
          </TabsTrigger>
          <TabsTrigger value="transactions" className="sm:flex-row flex-col gap-1">
            <Receipt className="mr-2 h-4 w-4" />
            Transacciones
          </TabsTrigger>
          <TabsTrigger value="inventory" className="sm:flex-row flex-col gap-1">
            <Package className="mr-2 h-4 w-4" />
            Inventario
          </TabsTrigger>
          <TabsTrigger value="customers" className="sm:flex-row flex-col gap-1">
            <Users className="mr-2 h-4 w-4" />
            Clientes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab summary={summary} />
        </TabsContent>
        <TabsContent value="register" className="mt-4">
          <NewTransactionTab products={initialProducts} services={initialServices} onDataChange={fetchData} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab initialTransactions={initialTransactions} onDataChange={fetchData} />
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <InventoryTab initialProducts={initialProducts} onDataChange={fetchData} />
        </TabsContent>
        <TabsContent value="customers" className="mt-4">
          <CustomersTab initialCustomers={initialCustomers} isLoading={isLoading} team={initialTeam} onDataChange={fetchData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
