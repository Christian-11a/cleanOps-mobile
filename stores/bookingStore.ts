// Mobile equivalent of the web's stores/bookingStore
import type { JobUrgency } from '@/types';

export type CleanType = {
  id: string;
  label: string;
  sub: string;
  price: number;
  icon: string;
};

export const CLEAN_TYPES: CleanType[] = [
  { id: 'regular',  label: 'Standard Refresh', sub: 'Routine maintenance clean', price: 60,  icon: '🧹' },
  { id: 'deep',     label: 'All-in-One Reset', sub: 'The complete home overhaul', price: 250, icon: '✨' },
  { id: 'move_out', label: 'Move-In / Move-Out', sub: 'Empty property transition', price: 180, icon: '📦' },
];

export const TASKS = [
  { id: 'vacuum',  label: 'Vacuum all rooms', icon: '🧺' },
  { id: 'mop',     label: 'Mop floors',       icon: '🪣' },
  { id: 'bath',    label: 'Clean bathrooms',  icon: '🚿' },
  { id: 'kitchen', label: 'Clean kitchen',    icon: '🍳' },
  { id: 'dishes',  label: 'Do the dishes',    icon: '🍽️' },
  { id: 'laundry', label: 'Laundry & fold',   icon: '👕' },
  { id: 'windows', label: 'Wash windows',     icon: '🪟' },
  { id: 'trash',   label: 'Empty trash',      icon: '🗑️' },
  { id: 'dust',    label: 'Dust surfaces',    icon: '🪴' },
  { id: 'fridge',  label: 'Clean fridge',     icon: '❄️' },
  { id: 'oven',    label: 'Clean oven',       icon: '♨️' },
  { id: 'outdoor', label: 'Outdoor/balcony',  icon: '🌿' },
];

export const URGENCIES: { value: JobUrgency; label: string; desc: string; fee: number; color: string }[] = [
  { value: 'LOW',    label: 'Standard Priority', desc: 'Flexible, within a week', fee: 0,     color: '#16a34a' },
  { value: 'NORMAL', label: 'Medium Priority',   desc: 'Within 48 hours',        fee: 10,  color: '#d97706' },
  { value: 'HIGH',   label: 'Urgent Priority',   desc: 'ASAP — act fast!',       fee: 25,  color: '#dc2626' },
];

export function computePrice(typeId: string, urgency: JobUrgency, tasksCount: number): number {
  const type = CLEAN_TYPES.find(t => t.id === typeId);
  const base = type?.price ?? 60;
  
  const urgencyObj = URGENCIES.find(u => u.value === urgency);
  const urgencyFee = urgencyObj?.fee ?? 0;
  
  // All-in-One is a premium flat rate (no extra task fees)
  const taskFee = typeId === 'deep' ? 0 : (tasksCount * 5);

  return base + urgencyFee + taskFee;
}
