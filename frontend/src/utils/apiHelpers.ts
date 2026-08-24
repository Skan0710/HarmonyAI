import type { ApiResponse } from '../services/api';

/**
 * Generic envelope for API responses that wrap data in { success, data, message }.
 */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Extract data from a standard API envelope response.
 * Handles the common pattern: check error → check envelope → fallback message.
 *
 * @param response - The raw apiClient response
 * @param fallbackMessage - Default error message if none provided by the API
 * @returns An object with `data` (or null) and `error` (or null)
 */
export function extractEnvelopeData<T>(
  response: ApiResponse<ApiEnvelope<T>>,
  fallbackMessage: string
): { data: T | null; error: string | null } {
  if (response.error) {
    return { data: null, error: response.error };
  }

  if (response.data && response.data.success && response.data.data !== undefined) {
    return { data: response.data.data, error: null };
  }

  return {
    data: null,
    error: response.data?.message || fallbackMessage,
  };
}

/**
 * Extract a list from a standard API envelope response.
 * Returns empty array instead of null for the data field.
 */
export function extractEnvelopeList<T>(
  response: ApiResponse<ApiEnvelope<T[]>>,
  fallbackMessage: string
): { items: T[]; error: string | null } {
  const result = extractEnvelopeData<T[]>(response, fallbackMessage);
  return {
    items: result.data || [],
    error: result.error,
  };
}

/**
 * Extract a success boolean from a delete/mutation response.
 */
export function extractSuccess(
  response: ApiResponse<ApiEnvelope<{ success: boolean }>>,
  fallbackMessage: string
): { success: boolean; error: string | null } {
  if (response.error) {
    return { success: false, error: response.error };
  }

  if (response.data && response.data.success) {
    return { success: true, error: null };
  }

  return {
    success: false,
    error: response.data?.message || fallbackMessage,
  };
}
