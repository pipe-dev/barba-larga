'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  verifyMasterLogsPin,
  getSystemLogs,
  resolveSystemLog,
  deleteSystemLog,
  clearResolvedLogs,
  createTestSystemLog,
  type SystemLog,
} from '@/app/actions';
import { APP_VERSION, getAppCommit } from '@/lib/telemetry';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Server,
  Globe,
  Database,
  Lock,
  Loader2,
  Terminal,
  Activity,
  PlusCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SystemLogsPage() {
  const { toast } = useToast();

  // Authentication states
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [pinInput, setPinInput] = React.useState('');
  const [pinError, setPinError] = React.useState('');
  const [isVerifyingPin, setIsVerifyingPin] = React.useState(false);
  const [showPin, setShowPin] = React.useState(false);
  const [failedAttempts, setFailedAttempts] = React.useState(0);
  const [lockoutSeconds, setLockoutSeconds] = React.useState(0);

  // Lockout countdown timer
  React.useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Data states
  const [logs, setLogs] = React.useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState<string>('all');
  const [sourceFilter, setSourceFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = React.useState<SystemLog | null>(null);

  const fetchLogs = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSystemLogs();
      setLogs(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los logs del sistema.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setPinError(`Demasiados intentos fallidos. Espera ${lockoutSeconds} segundos.`);
      return;
    }
    if (!pinInput.trim()) return;
    setIsVerifyingPin(true);
    setPinError('');

    try {
      const res = await verifyMasterLogsPin(pinInput.trim());
      if (res.success) {
        setIsUnlocked(true);
        setFailedAttempts(0);
        toast({
          title: 'Acceso Autorizado',
          description: 'Consola de diagnóstico desbloqueada.',
        });
        fetchLogs();
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutSeconds(30);
          setPinError('Demasiados intentos fallidos. Bloqueado temporalmente por 30 segundos.');
        } else {
          setPinError(`PIN de seguridad incorrecto. Intento ${nextAttempts} de 5.`);
        }
      }
    } catch (err) {
      setPinError('Error de autenticación.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleCopyError = (log: SystemLog) => {
    const errorReport = {
      id: log.id,
      timestamp: log.createdAt,
      version: log.version || 'v2.1',
      commit: log.commit || 'c3c3603',
      level: log.level,
      source: log.source,
      action: log.action,
      message: log.message,
      stackTrace: log.stackTrace,
      metadata: log.metadata,
      userAgent: log.userAgent,
      ip: log.ip,
      resolved: log.resolved,
    };

    const formattedText = `=== REPORTE DE ERROR / LOG DEL SISTEMA ===
Fecha: ${format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')} (Bogotá)
Versión: ${log.version || 'v2.1'} (Commit: ${log.commit || 'c3c3603'})
Nivel: [${log.level.toUpperCase()}]
Fuente: ${log.source}
Acción: ${log.action}
Mensaje: ${log.message}

Detalles JSON:
${JSON.stringify(errorReport, null, 2)}
==========================================`;

    navigator.clipboard.writeText(formattedText);
    setCopiedId(log.id);
    toast({
      title: '¡Copiado!',
      description: 'El reporte técnico del error se ha copiado al portapapeles.',
    });
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleResolve = async (id: string) => {
    const res = await resolveSystemLog(id);
    if (res.success) {
      toast({ title: 'Éxito', description: res.message });
      setLogs(prev => prev.map(l => (l.id === id ? { ...l, resolved: true } : l)));
      if (selectedLog?.id === id) {
        setSelectedLog(prev => (prev ? { ...prev, resolved: true } : null));
      }
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteSystemLog(id);
    if (res.success) {
      toast({ title: 'Eliminado', description: res.message });
      setLogs(prev => prev.filter(l => l.id !== id));
      if (selectedLog?.id === id) {
        setSelectedLog(null);
      }
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
  };

  const handleClearResolved = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar todos los logs resueltos?')) return;
    const res = await clearResolvedLogs();
    if (res.success) {
      toast({ title: 'Limpieza Completa', description: res.message });
      fetchLogs();
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
  };

  const handleCreateTestLog = async () => {
    const res = await createTestSystemLog();
    if (res.success) {
      toast({ title: 'Test Exitoso', description: res.message });
      fetchLogs();
    } else {
      toast({ title: 'Error', description: res.message, variant: 'destructive' });
    }
  };

  // Filtered logs
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        !searchQuery ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.ip && log.ip.includes(searchQuery));

      const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
      const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && !log.resolved) ||
        (statusFilter === 'resolved' && log.resolved);

      return matchesSearch && matchesLevel && matchesSource && matchesStatus;
    });
  }, [logs, searchQuery, levelFilter, sourceFilter, statusFilter]);

  // Statistics
  const stats = React.useMemo(() => {
    return {
      total: logs.length,
      critical: logs.filter(l => l.level === 'critical').length,
      errors: logs.filter(l => l.level === 'error').length,
      emailFailures: logs.filter(l => l.source === 'email').length,
      frontendFailures: logs.filter(l => l.source === 'frontend').length,
      resolved: logs.filter(l => l.resolved).length,
    };
  }, [logs]);

  // 1. PIN LOCK SCREEN
  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm border-primary/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Consola de Diagnóstico
            </CardTitle>
            <div className="flex items-center justify-center gap-2 mt-1 mb-2">
              <Badge className="bg-primary text-black font-semibold text-xs px-2.5 py-0.5">
                Versión 2.1
              </Badge>
              <Badge variant="outline" className="font-mono text-[11px] border-primary/30 text-primary">
                Commit: {getAppCommit()}
              </Badge>
            </div>
            <CardDescription>
              Introduce el PIN de seguridad maestro para acceder a los logs y auditoría del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPin ? "text" : "password"}
                  placeholder="PIN de Seguridad"
                  className="pl-9 pr-10 text-center text-lg tracking-widest"
                  maxLength={12}
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  autoFocus
                  required
                  disabled={lockoutSeconds > 0 || isVerifyingPin}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pinError && (
                <p className="text-center text-sm font-medium text-destructive">
                  {pinError}
                </p>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isVerifyingPin || lockoutSeconds > 0 || !pinInput.trim()}
              >
                {isVerifyingPin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : lockoutSeconds > 0 ? (
                  `Bloqueado (${lockoutSeconds}s)`
                ) : (
                  'Desbloquear Consola'
                )}
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al Panel Principal
                </Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. MAIN LOGS DASHBOARD
  return (
    <div className="container mx-auto space-y-6 p-4 md:p-8">
      {/* Top Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a Citas
              </Link>
            </Button>
            <Badge variant="outline" className="border-primary/40 text-primary">
              <Lock className="mr-1 h-3 w-3" />
              PIN Maestro Activo
            </Badge>
            <Badge className="bg-primary text-black font-bold text-xs px-2.5 py-0.5 shadow-sm">
              Versión 2.1
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs text-muted-foreground border border-white/10">
              Commit: {getAppCommit()}
            </Badge>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl flex-wrap">
            <Terminal className="h-7 w-7 text-primary" />
            <span>Centro de Telemetría y Logs del Sistema</span>
            <span className="text-xs font-mono font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              v2.1 • {getAppCommit()}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor centralizado de errores, fallos de red, envíos de correo y salud de la base de datos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCreateTestLog}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Generar Log de Prueba
          </Button>
          {stats.resolved > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearResolved}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar Resueltos ({stats.resolved})
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Logs</p>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-red-500">Críticos</p>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-500">{stats.critical}</p>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-amber-500">Errores Backend</p>
            <Server className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-500">{stats.errors}</p>
        </Card>

        <Card className="border-purple-500/30 bg-purple-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-purple-400">Fallos Email</p>
            <Mail className="h-4 w-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-400">{stats.emailFailures}</p>
        </Card>

        <Card className="border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-cyan-400">Frontend / Web</p>
            <Globe className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-cyan-400">{stats.frontendFailures}</p>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-emerald-500">Resueltos</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-500">{stats.resolved}</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Input
              placeholder="Buscar por mensaje, acción, IP..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full"
            />

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Nivel de Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Niveles</SelectItem>
                <SelectItem value="critical">🔴 Crítico</SelectItem>
                <SelectItem value="error">🟠 Error</SelectItem>
                <SelectItem value="warning">🟡 Advertencia</SelectItem>
                <SelectItem value="info">🔵 Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Origen del Log" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Fuentes</SelectItem>
                <SelectItem value="backend">⚡ Backend</SelectItem>
                <SelectItem value="email">✉️ Email (Gmail)</SelectItem>
                <SelectItem value="frontend">🌐 Frontend (Web)</SelectItem>
                <SelectItem value="database">🗄️ Base de Datos</SelectItem>
                <SelectItem value="auth">🔒 Autenticación</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="pending">⏳ Solo Pendientes</SelectItem>
                <SelectItem value="resolved">✅ Solo Resueltos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Registros ({filteredLogs.length})
            </CardTitle>
            {filteredLogs.length !== logs.length && (
              <span className="text-xs text-muted-foreground">
                (Filtrado de un total de {logs.length} registros)
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center p-4 text-center">
              <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-500" />
              <h3 className="text-lg font-semibold">No se encontraron errores</h3>
              <p className="text-sm text-muted-foreground">
                El sistema está funcionando correctamente sin anomalías detectadas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Nivel</TableHead>
                    <TableHead className="w-[120px]">Fuente</TableHead>
                    <TableHead className="w-[120px]">Versión</TableHead>
                    <TableHead className="w-[180px]">Acción</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead className="w-[150px]">Fecha (Bogotá)</TableHead>
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead className="w-[200px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const isCopied = copiedId === log.id;
                    const dateFormatted = format(
                      new Date(log.createdAt),
                      'dd/MM/yy HH:mm:ss',
                      { locale: es }
                    );

                    return (
                      <TableRow
                        key={log.id}
                        className={log.resolved ? 'opacity-60 bg-muted/20' : ''}
                      >
                        {/* Level Badge */}
                        <TableCell>
                          {log.level === 'critical' && (
                            <Badge variant="destructive" className="font-mono">
                              CRÍTICO
                            </Badge>
                          )}
                          {log.level === 'error' && (
                            <Badge className="bg-amber-500/20 text-amber-500 font-mono hover:bg-amber-500/30">
                              ERROR
                            </Badge>
                          )}
                          {log.level === 'warning' && (
                            <Badge className="bg-yellow-500/20 text-yellow-500 font-mono hover:bg-yellow-500/30">
                              ADVERTENCIA
                            </Badge>
                          )}
                          {log.level === 'info' && (
                            <Badge variant="secondary" className="font-mono">
                              INFO
                            </Badge>
                          )}
                        </TableCell>

                        {/* Source Badge */}
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.source === 'email' && <Mail className="mr-1 h-3 w-3" />}
                            {log.source === 'backend' && <Server className="mr-1 h-3 w-3" />}
                            {log.source === 'frontend' && <Globe className="mr-1 h-3 w-3" />}
                            {log.source === 'database' && <Database className="mr-1 h-3 w-3" />}
                            {log.source}
                          </Badge>
                        </TableCell>

                        {/* Version Badge */}
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[11px] bg-primary/5 text-primary border-primary/20">
                            {log.version || 'v2.1'}
                            <span className="text-[9px] text-muted-foreground ml-1">({log.commit?.substring(0, 7) || 'c3c3603'})</span>
                          </Badge>
                        </TableCell>

                        {/* Action */}
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          {log.action}
                        </TableCell>

                        {/* Message Preview */}
                        <TableCell className="max-w-[320px] truncate text-sm">
                          {log.message}
                        </TableCell>

                        {/* Date */}
                        <TableCell className="text-xs text-muted-foreground">
                          {dateFormatted}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {log.resolved ? (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-500">
                              Resuelto
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-500 text-red-500">
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action Buttons */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* COPIAR ERROR BUTTON */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                              onClick={() => handleCopyError(log)}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-xs">¡Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span className="text-xs">Copiar error</span>
                                </>
                              )}
                            </Button>

                            {/* VER DETALLE BUTTON */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setSelectedLog(log)}
                            >
                              Ver
                            </Button>

                            {/* MARCAR RESUELTO BUTTON */}
                            {!log.resolved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-emerald-500 hover:text-emerald-400"
                                onClick={() => handleResolve(log.id)}
                                title="Marcar como resuelto"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}

                            {/* ELIMINAR BUTTON */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(log.id)}
                              title="Eliminar este log"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <Dialog open={!!selectedLog} onOpenChange={open => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={selectedLog.level === 'critical' ? 'destructive' : 'secondary'}>
                    {selectedLog.level.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">{selectedLog.source}</Badge>
                  <Badge className="bg-primary/20 text-primary font-mono text-xs border border-primary/30">
                    {selectedLog.version || 'v2.1'} ({selectedLog.commit || 'c3c3603'})
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">ID: {selectedLog.id}</span>
                </div>
                <DialogTitle className="text-xl font-bold mt-2">
                  {selectedLog.action}
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(selectedLog.createdAt), "EEEE d 'de' MMMM 'de' yyyy, HH:mm:ss", {
                    locale: es,
                  })}{' '}
                  (Hora de Colombia)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Error Message */}
                <div>
                  <h4 className="font-semibold text-foreground">Mensaje del Error:</h4>
                  <div className="mt-1 rounded-md bg-destructive/10 p-3 text-destructive border border-destructive/20 font-mono text-xs">
                    {selectedLog.message}
                  </div>
                </div>

                {/* Stack Trace */}
                {selectedLog.stackTrace && (
                  <div>
                    <h4 className="font-semibold text-foreground">Traza de Pila (Stack Trace):</h4>
                    <pre className="mt-1 max-h-48 overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap border border-zinc-800">
                      {selectedLog.stackTrace}
                    </pre>
                  </div>
                )}

                {/* Metadata JSON */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground">Metadatos Contextuales:</h4>
                    <pre className="mt-1 max-h-40 overflow-x-auto rounded-md bg-zinc-950 p-3 text-xs text-emerald-400 font-mono whitespace-pre border border-zinc-800">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Technical Environment Details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-3">
                  <div>
                    <span className="font-semibold text-foreground">IP de Origen:</span>{' '}
                    {selectedLog.ip || 'N/A'}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Estado:</span>{' '}
                    {selectedLog.resolved ? 'Solucionado' : 'Pendiente'}
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="font-semibold text-foreground">Navegador / Dispositivo:</span>{' '}
                    {selectedLog.userAgent || 'Server'}
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 mt-4">
                <Button
                  variant="outline"
                  className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => handleCopyError(selectedLog)}
                >
                  <Copy className="h-4 w-4" />
                  Copiar error
                </Button>

                {!selectedLog.resolved && (
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(selectedLog.id)}
                  >
                    <Check className="mr-2 h-4 w-4 text-emerald-500" />
                    Marcar como Solucionado
                  </Button>
                )}

                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedLog.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
