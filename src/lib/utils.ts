
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const cleanFileName = (name: string): string => {
  if (!name) return '';
  const withoutExtension = name.substring(0, name.lastIndexOf('.')) || name;
  return withoutExtension
      .replace(/FOTOGRAFIA/ig, '') // Elimina "FOTOGRAFIA" (insensible a mayúsculas/minúsculas)
      .replace(/[0-9]/g, '')     // Elimina números
      .replace(/[_-]/g, ' ')         // Reemplaza guiones bajos y guiones con espacios
      .replace(/\s+/g, ' ')       // Reemplaza múltiples espacios con uno solo
      .trim();                    // Elimina espacios al inicio y al final
}

export const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

    