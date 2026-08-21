import { apiClient } from './api';

export interface AssistantStepDTO {
  stepNumber: number;
  toolName: string;
  input: Record<string, any>;
  result: {
    success: boolean;
    toolName: string;
    data?: any;
    message?: string;
    error?: string;
  };
  success: boolean;
  message?: string;
}

export interface AssistantChatResponseDTO {
  success: boolean;
  userPrompt: string;
  responseMessage: string;
  isMultiStep: boolean;
  status: 'completed' | 'partial_failure' | 'failed';
  actionConfirmation?: string;
  steps?: AssistantStepDTO[];
  data?: any;
}

export const sendAssistantMessage = async (
  prompt: string,
  sessionId?: string
): Promise<{ success: boolean; data?: AssistantChatResponseDTO; error?: string }> => {
  const res = await apiClient<AssistantChatResponseDTO>('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt, sessionId }),
  });

  if (res.error) {
    return { success: false, error: res.error };
  }

  return { success: true, data: res.data };
};
