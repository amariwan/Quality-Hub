import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {}
) {
  const { decimals = 0, sizeType = 'normal' } = opts;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'] as const;

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 Bytes';
  }

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes.length - 1
  );
  const unit = sizeType === 'accurate' ? accurateSizes : sizes;

  return `${(bytes / Math.pow(1024, unitIndex)).toFixed(decimals)} ${unit[unitIndex]}`;
}
