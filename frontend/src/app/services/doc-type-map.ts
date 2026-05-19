import { UploadDocType } from './api.models';

export type CanonicalDocType = 'terms' | 'privacy' | 'cookie';

export function latestIndexToCanonicalDocType(value: string): CanonicalDocType {
  if (value === 'terms-of-use' || value === 'terms') return 'terms';
  if (value === 'privacy-policy' || value === 'privacy') return 'privacy';
  if (value === 'cookie-policy' || value === 'cookie') return 'cookie';
  return 'terms';
}

export function uploadDocTypeToCanonical(value: UploadDocType): CanonicalDocType {
  return latestIndexToCanonicalDocType(value);
}
