import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const cleanFileName = (name: string): string => {
  const withoutExtension = name.substring(0, name.lastIndexOf('.')) || name;
  return withoutExtension
      .replace(/FOTOGRAFIA/ig, '') // Elimina "FOTOGRAFIA" (insensible a mayúsculas/minúsculas)
      .replace(/[0-9]/g, '')     // Elimina números
      .replace(/_/g, ' ')         // Reemplaza guiones bajos con espacios
      .trim();                    // Elimina espacios al inicio y al final
}
