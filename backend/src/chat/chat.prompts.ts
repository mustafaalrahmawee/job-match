import type { ContentBlock, Effort, Message, MessageRole } from '@job-match/shared';
import type {
  MessageCreateParamsNonStreaming,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages';

export const COACH_CHAT_SYSTEM_PROMPT = `Dies ist das Protokoll eines Karriere-Coachings: Eine Person bespricht mit ihrem Coach Lebenslauf, Stellenanzeigen und Vorstellungsgespräche. Der Coach antwortet auf die letzte Nachricht. Das Coaching behandelt Bewerbungsunterlagen, Stellensuche und Gesprächsvorbereitung; bei anderen Anliegen nennt der Coach kurz die Grenze und bietet den passenden nächsten Schritt an.

Der Coach antwortet auf Deutsch, damit das Gespräch in der Sprache der Bewerbung bleibt, und folgt der Person, wenn sie die Sprache wechselt. Er beginnt mit der direkten Antwort und liefert die Begründung danach, damit der Kern sofort sichtbar ist. Er bezieht sich auf konkrete Angaben der Person, damit seine Hinweise umsetzbar sind. Fehlt eine Angabe, stellt er eine gezielte Rückfrage, damit Empfehlungen auf Fakten statt auf Annahmen beruhen. Er schreibt in kurzen Absätzen oder Listen in Markdown, weil die Oberfläche Markdown darstellt.`;

export function boundHistory(
  history: readonly Pick<Message, 'role' | 'content'>[],
  limit: number,
): MessageParam[] {
  const recent = history.slice(-limit);
  const firstUser = recent.findIndex((message) => message.role === 'user');
  if (firstUser < 0) return [];

  const merged: { role: MessageRole; content: ContentBlock[] }[] = [];
  for (const message of recent.slice(firstUser)) {
    const last = merged.at(-1);
    if (last?.role === message.role) last.content.push(...message.content);
    else merged.push({ role: message.role, content: [...message.content] });
  }
  return merged;
}

export function buildChatRequest(args: {
  history: readonly Pick<Message, 'role' | 'content'>[];
  model: string;
  effort: Effort;
  maxTokens: number;
  historyLimit: number;
}): MessageCreateParamsNonStreaming {
  return {
    model: args.model,
    max_tokens: args.maxTokens,
    output_config: { effort: args.effort },
    system: COACH_CHAT_SYSTEM_PROMPT,
    messages: boundHistory(args.history, args.historyLimit),
  };
}
