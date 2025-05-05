import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Get color for a mood value (0-100)
export function getMoodColor(value: number): string {
  if (value >= 70) return "#4ADE80"; // Good - green
  if (value >= 40) return "#FACC15"; // Neutral - yellow
  return "#F97316"; // Bad - orange
}

// Format large numbers with commas
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Generate random ID (for client-side only)
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Convert base64 to blob (for file uploads)
export function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}
