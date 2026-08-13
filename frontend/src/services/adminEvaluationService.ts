import { apiClient } from './api';

export interface EvaluationMetricsPayload {
  precisionAtK: number;
  recallAtK: number;
  f1AtK: number;
  diversityScore: number;
  genreDiversity: number;
  artistDiversity: number;
  noveltyScore: number;
  catalogCoverage: number;
  hitsCount: number;
  recommendedCount: number;
  relevantCount: number;
  totalCatalogCount: number;
}

export interface EvaluationApiResponse {
  success: boolean;
  strategy: 'content' | 'collaborative' | 'hybrid';
  k: number;
  metrics: EvaluationMetricsPayload;
  message?: string;
}

export const fetchRecommendationEvaluationApi = async (
  strategy: 'content' | 'collaborative' | 'hybrid' = 'hybrid',
  k = 10
): Promise<{ metrics: EvaluationMetricsPayload | null; error: string | null }> => {
  try {
    const response = await apiClient<EvaluationApiResponse>(
      `/admin/recommendations/evaluate?strategy=${strategy}&k=${k}`,
      { method: 'GET' }
    );

    if (response.error) {
      return { metrics: null, error: response.error };
    }

    if (response.data && response.data.success && response.data.metrics) {
      return { metrics: response.data.metrics, error: null };
    }

    return {
      metrics: null,
      error: response.data?.message || 'Failed to fetch recommendation evaluation metrics',
    };
  } catch (err: any) {
    return { metrics: null, error: err.message || 'Failed to fetch evaluation metrics' };
  }
};
