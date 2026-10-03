import Anthropic from '@anthropic-ai/sdk';

export function describeLlmError(error: unknown): { code: string; message: string } {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  ) {
    return {
      code: 'llm_misconfigured',
      message: 'Die Verbindung zum KI-Anbieter ist nicht richtig eingerichtet.',
    };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return {
      code: 'llm_rejected',
      message: 'Der KI-Anbieter hat die Anfrage abgelehnt. Vielleicht ist das Gespräch zu lang.',
    };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      code: 'llm_unavailable',
      message: 'Der KI-Anbieter ist gerade nicht verfügbar. Bitte versuche es gleich noch einmal.',
    };
  }
  return { code: 'internal', message: 'Es ist ein Fehler aufgetreten.' };
}
