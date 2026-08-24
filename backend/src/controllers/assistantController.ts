import { Request, Response } from 'express';
import { MultiStepAssistantService } from '../services/multiStepAssistantService.js';
import { AssistantIntentService } from '../services/assistantIntentService.js';
import { AssistantToolContext } from '../tools/toolTypes.js';
import { controllerWrapper, ControllerError } from '../utils/controllerHelpers.js';

export const MAX_MESSAGE_LENGTH = 500;

export const handleAssistantChat = controllerWrapper(async (req: Request, res: Response) => {
  const { prompt, sessionId } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new ControllerError(400, 'A non-empty prompt string is required');
  }

  if (prompt.length > MAX_MESSAGE_LENGTH) {
    throw new ControllerError(400, `Message exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const trimmedPrompt = prompt.trim();
  const userId = (req as any).user?.id || (req as any).user?._id?.toString();

  const context: AssistantToolContext = {
    userId,
    sessionId,
    userRole: (req as any).user?.role,
  };

  // Check if multi-step action is needed
  if (MultiStepAssistantService.isCompositeMultiStepRequest(trimmedPrompt)) {
    const multiResult = await MultiStepAssistantService.executeMultiStepAction(
      trimmedPrompt,
      context
    );

    let actionConfirmation = undefined;
    if (multiResult.status === 'completed') {
      const lastStep = multiResult.stepsExecuted[multiResult.stepsExecuted.length - 1];
      actionConfirmation = lastStep?.message || `Executed ${multiResult.stepsExecuted.length} actions successfully`;
    }

    res.json({
      success: multiResult.status === 'completed',
      userPrompt: trimmedPrompt,
      responseMessage: multiResult.responseMessage,
      isMultiStep: true,
      status: multiResult.status,
      actionConfirmation,
      steps: multiResult.stepsExecuted,
      data: multiResult.finalData,
    });
    return;
  }

  // Single step assistant execution
  const singleResult = await AssistantIntentService.processAssistantRequest(
    trimmedPrompt,
    context
  );

  const isToolSuccess = singleResult.toolExecutionResult?.success ?? true;
  let actionConfirmation = undefined;
  if (singleResult.intent.type === 'tool_call' && isToolSuccess) {
    actionConfirmation = singleResult.toolExecutionResult?.message;
  }

  res.json({
    success: isToolSuccess,
    userPrompt: trimmedPrompt,
    responseMessage: singleResult.responseMessage,
    isMultiStep: false,
    status: isToolSuccess ? 'completed' : 'failed',
    intent: singleResult.intent,
    actionConfirmation,
    data: singleResult.data,
  });
});
