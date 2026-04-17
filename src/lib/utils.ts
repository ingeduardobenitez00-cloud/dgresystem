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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
    .replace(/^[\d\s-]*/, '') // Elimina números, guiones y espacios al inicio
    .replace(/\s+/g, ' ') // Espacios múltiples a uno solo
    .trim();
};

export const getFuzzyMatch = (str1: string, str2: string): number => {
  const s1 = normalizeGeo(str1);
  const s2 = normalizeGeo(str2);
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;

  const distance = (s1: string, s2: string) => {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };

  const editDistance = distance(longer, shorter);
  return (longerLength - editDistance) / longerLength;
};
