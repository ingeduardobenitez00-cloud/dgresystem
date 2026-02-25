
'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

// FIX CRÍTICO: Soluciona el problema de los iconos de marcador rotos en Next.js
if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

interface MapModuleProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function MapModule({ onLocationSelect }: MapModuleProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLocationFixed, setIsLocationFixed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) return;

    // 1. Limpiar instancia previa si existe
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // 2. Inicializar Mapa con DoubleClickZoom DESACTIVADO para permitir marcación
    const map = L.map(containerRef.current, {
      center: [-25.3006, -57.6359], // Justicia Electoral Asunción
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
      doubleClickZoom: false // Importante: evita que el mapa haga zoom al intentar marcar
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // 3. Configurar Buscador
    const provider = new OpenStreetMapProvider();
    const searchControl = new (GeoSearchControl as any)({
      provider,
      style: 'bar',
      showMarker: false,
      autoClose: true,
      searchLabel: 'Buscar dirección...',
      keepResult: true
    });
    map.addControl(searchControl);

    // 4. Captura por Doble Clic REFORZADA
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remover marcador anterior
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }
      
      // Crear nuevo marcador con icono oficial corregido
      markerRef.current = L.marker([lat, lng]).addTo(map);
      
      // Notificar al padre y actualizar UI local
      onLocationSelect(lat, lng);
      setIsLocationFixed(true);
      
      // Centrar levemente para confirmar acción visual
      map.panTo([lat, lng]);
    });

    mapRef.current = map;

    // 5. CICLO DE SINCRONIZACIÓN AGRESIVA
    const syncIntervals = [100, 500, 1000, 2000];
    syncIntervals.forEach(delay => {
      setTimeout(() => {
        if (mapRef.current) mapRef.current.invalidateSize();
      }, delay);
    });

    // ResizeObserver para cambios de diseño
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onLocationSelect]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="h-8 w-8 rounded-lg bg-black text-white flex items-center justify-center shadow-lg">
          <MapPin className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight text-primary">GEORREFERENCIACIÓN DEL EVENTO</h2>
      </div>

      <Separator className="bg-muted-foreground/10" />

      <div className="p-5 bg-[#F3F4F6] border-2 border-dashed border-muted-foreground/20 rounded-2xl text-center">
        <p className="text-[10px] font-black uppercase tracking-widest leading-tight">
          DOBLE CLIC EN EL MAPA PARA CAPTURAR COORDENADAS EXACTAS
        </p>
      </div>

      <div className="relative group">
        <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="map-view-container border-4 border-white shadow-2xl relative z-10" ref={containerRef} style={{ height: '400px' }}></div>
      </div>

      <div className="p-6 bg-[#F3F4F6] rounded-[2.5rem] flex items-center gap-6 shadow-inner border border-muted-foreground/5">
        <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center shadow-md">
          <Navigation className={cn("h-6 w-6 transition-colors", isLocationFixed ? "text-green-600" : "text-muted-foreground/40")} />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">COORDENADAS GPS</span>
          <span className={cn(
            "text-sm font-black uppercase tracking-tighter",
            isLocationFixed ? "text-green-600" : "text-[#1A1A1A]"
          )}>
            {isLocationFixed ? "UBICACIÓN FIJADA CORRECTAMENTE" : "PENDIENTE DE CAPTURA"}
          </span>
        </div>
      </div>
    </div>
  );
}
