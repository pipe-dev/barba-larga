'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { uploadImageToImgBB } from '@/app/actions/upload';
import { getSafeImageUrl } from '@/lib/image-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, X, CheckCircle2, Link as LinkIcon, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function ImageUploader({ value, onChange, label = "Imagen", placeholder = "Sube o arrastra una foto", className }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Archivo inválido",
        description: "Por favor selecciona un archivo de imagen (JPG, PNG, WEBP, etc.).",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 32 * 1024 * 1024) {
      toast({
        title: "Imagen muy grande",
        description: "El tamaño máximo permitido por ImgBB es de 32MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || 'ee478f85a2e97387a2e9a62d2b984e48';
      let cdnUrl = '';

      // 1. Direct client-side upload to ImgBB CDN
      try {
        const directFormData = new FormData();
        directFormData.append('image', file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: 'POST',
          body: directFormData,
        });
        const data = await response.json();
        if (data.success && data.data?.url) {
          cdnUrl = data.data.url;
        }
      } catch (clientErr) {
        console.warn('Client ImgBB upload fallback to server action:', clientErr);
      }

      // 2. Server Action fallback
      if (!cdnUrl) {
        const formData = new FormData();
        formData.append('image', file);
        const result = await uploadImageToImgBB(formData);
        if (result.success && result.url) {
          cdnUrl = result.url;
        }
      }

      if (cdnUrl) {
        onChange(cdnUrl);
        toast({
          title: "¡Imagen lista en ImgBB!",
          description: "La foto se ha subido y optimizado en el CDN.",
        });
        return;
      }

      toast({
        title: "Error al subir a ImgBB",
        description: "No se pudo completar la subida al CDN de ImgBB. Intenta de nuevo.",
        variant: "destructive"
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({
        title: "Error de red",
        description: "Hubo un fallo al subir la imagen al CDN de ImgBB.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    onChange("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        {label && <Label className="text-sm font-medium">{label}</Label>}
        <button
          type="button"
          onClick={() => setShowManualUrl(!showManualUrl)}
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <LinkIcon className="w-3 h-3" />
          {showManualUrl ? "Subir archivo" : "Pegar enlace URL"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />

      {showManualUrl ? (
        <div className="space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://i.ibb.co/... o /multimedia/..."
          />
          {value && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
              <Image
                src={getSafeImageUrl(value)}
                alt="Preview"
                fill
                className="object-cover"
              />
            </div>
          )}
        </div>
      ) : value ? (
        <div className="relative group flex items-center gap-4 p-3 bg-muted/30 border border-border rounded-xl">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-primary/30 shrink-0 shadow-md">
            <Image
              src={getSafeImageUrl(value)}
              alt="Vista previa"
              fill
              className="object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Imagen lista</span>
            </div>
            <p className="text-xs text-muted-foreground truncate" title={value}>{value}</p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs"
              >
                <Camera className="w-3 h-3 mr-1" />
                Cambiar foto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isUploading}
                onClick={handleClear}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-3 h-3 mr-1" />
                Quitar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2",
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            isUploading && "pointer-events-none opacity-80"
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-white">Subiendo foto a ImgBB...</p>
              <p className="text-xs text-muted-foreground">Optimizando para móviles</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  Toca aquí para elegir foto o arrástrala
                </p>
                <p className="text-xs text-muted-foreground">
                  Cámara, galería de fotos o archivos (JPG, PNG, WEBP)
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
