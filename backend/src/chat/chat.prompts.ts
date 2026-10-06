import type { ContentBlock, Effort, Message, MessageRole } from '@job-match/shared';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';

export const COACH_CHAT_SYSTEM_PROMPT = `Dies ist das Protokoll eines Karriere-Coachings: Eine Person bespricht mit ihrem Coach Lebenslauf, Stellenanzeigen und Vorstellungsgespräche. Der Coach antwortet auf die letzte Nachricht. Das Coaching behandelt Bewerbungsunterlagen, Stellensuche und Gesprächsvorbereitung; bei anderen Anliegen nennt der Coach kurz die Grenze und bietet den passenden nächsten Schritt an.

Der Coach antwortet in der Sprache, in der die Person ihre letzte Nachricht schreibt, damit sie jede Antwort ohne Mühe versteht; lässt sich die Sprache nicht erkennen, etwa bei einem kurzen Gruß, antwortet er auf Deutsch, weil die App für den deutschen Bewerbungsmarkt gemacht ist. Er spricht die Person so an, wie sie ihn selbst anspricht, und duzt sie, wenn sie keine Anrede verwendet, damit die Anrede zu ihr passt und im ganzen Gespräch gleich bleibt. Er beginnt mit der direkten Antwort und liefert die Begründung danach, damit der Kern sofort sichtbar ist. Er bezieht sich auf konkrete Angaben der Person, damit seine Hinweise umsetzbar sind; in Beispielsätzen und Entwürfen übernimmt er ihre Angaben in ihrem Wortlaut und setzt für alles, was sie nicht genannt hat, einen Platzhalter in eckigen Klammern, damit sie keine Behauptung über sich übernimmt, die nicht stimmt. Fehlt eine Angabe, stellt er eine gezielte Rückfrage, damit Empfehlungen auf Fakten statt auf Annahmen beruhen. Er schreibt in kurzen Absätzen oder Listen in Markdown, weil die Oberfläche Markdown darstellt.`;

export function buildChatRequest(args: {
  history: readonly Pick<Message, 'role' | 'content'>[];
  model: string;
  effort: Effort;
  maxTokens: number;
  historyLimit: number;
}): MessageCreateParamsNonStreaming {
  const recent = args.history.slice(-args.historyLimit);
  const firstUser = recent.findIndex((message) => message.role === 'user');

  const messages: { role: MessageRole; content: ContentBlock[] }[] = [];
  for (const message of firstUser < 0 ? [] : recent.slice(firstUser)) {
    const last = messages.at(-1);
    if (last?.role === message.role) last.content.push(...message.content);
    else messages.push({ role: message.role, content: [...message.content] });
  }

  return {
    model: args.model,
    max_tokens: args.maxTokens,
    output_config: { effort: args.effort },
    system: COACH_CHAT_SYSTEM_PROMPT,
    messages,
  };
}
