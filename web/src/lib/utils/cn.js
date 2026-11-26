import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class lists so a caller's `class` prop can override a component's
 * defaults instead of fighting them in the cascade.
 *
 * @param {...import('clsx').ClassValue} inputs
 * @returns {string}
 */
export const cn = (...inputs) => twMerge(clsx(inputs));
