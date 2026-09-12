import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class combiner: clsx for conditionals, tailwind-merge so a
 * caller's `className` can override a component's defaults. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
