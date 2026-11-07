import type { LucideIcon } from 'lucide-react';
import { Bike, Bus, BusFront, CarFront, Construction, Truck, Zap } from 'lucide-react';
import type { MarkerColor, MarkerSize, MarkerStyle, VehicleKind } from './types';

export const VEHICLE_TYPES: { id: VehicleKind; label: string; icon: LucideIcon }[] = [
  { id: 'CAR', label: 'Car', icon: CarFront },
  { id: 'VAN', label: 'Van', icon: BusFront },
  { id: 'TRUCK', label: 'Truck', icon: Truck },
  { id: 'MOTORCYCLE', label: 'Motorcycle', icon: Bike },
  { id: 'SCOOTER', label: 'Scooter', icon: Zap },
  { id: 'BICYCLE', label: 'Bicycle', icon: Bike },
  { id: 'BUS', label: 'Bus', icon: Bus },
  { id: 'UTILITY', label: 'Utility', icon: Construction }
];

export const MARKER_STYLES: { id: MarkerStyle; label: string; copy: string }[] = [
  { id: 'DOT', label: 'Standard dot', copy: 'Current marker' },
  { id: 'SILHOUETTE', label: 'Silhouette', copy: 'Clean profile' },
  { id: 'DIRECTIONAL', label: 'Directional', copy: 'Shows heading' },
  { id: 'BADGE', label: 'Round badge', copy: 'Strong at a glance' },
  { id: 'PIN', label: 'Map pin', copy: 'Classic location' },
  { id: 'OUTLINE', label: 'Outline', copy: 'Low map coverage' },
  { id: 'STATUS', label: 'Status chip', copy: 'Vehicle + state' },
  { id: 'HIGH_VISIBILITY', label: 'High visibility', copy: 'For dense maps' }
];

export const MARKER_COLORS: MarkerColor[] = ['BLUE', 'VIOLET', 'GREEN', 'AMBER'];
export const MARKER_SIZES: MarkerSize[] = ['SMALL', 'MEDIUM', 'LARGE'];
export const markerColorHex: Record<MarkerColor, string> = { BLUE: '#3578eb', VIOLET: '#6558f5', GREEN: '#1a9b70', AMBER: '#d88716' };

export const vehicleType = (kind: VehicleKind) => VEHICLE_TYPES.find(item => item.id === kind) ?? VEHICLE_TYPES[0]!;
