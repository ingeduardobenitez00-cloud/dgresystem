import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const cleanFileName = (name: string): string => {
  if (!name) return '';
  const withoutExtension = name.substring(0, name.lastIndexOf('.')) || name;
  // This function is used to format titles from filenames or alt text.
  return withoutExtension
      .replace(/[_-]/g, ' ')         // Reemplaza guiones bajos y guiones con espacios
      .replace(/#/g, '')          // Elimina el símbolo de hash
      .replace(/\s+/g, ' ')       // Reemplaza múltiples espacios con uno solo
      .trim();                    // Elimina espacios al inicio y al final
}

export const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

export const formatDateToDDMMYYYY = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    // Expected format YYYY-MM-DD -> Output DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
}

export const normalizeGeo = (str: string) => {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/^[\d\s-]*/, '') // Elimina TODO rastro de números, guiones y espacios al inicio
    .trim();
};
