'use strict';

/**
 * Claude Code transcript lines → the hook payloads the collector already
 * understands.
 *
 * Claude Code writes every session to ~/.claude/projects/<project>/<session>.jsonl,
 * and each subagent to <session>/subagents/agent-<id>.jsonl. Reading them lets
 * the panel see sessions that have no hooks: sessions opened before the hooks
 * were installed (Claude Code reads hooks only at start), or with hooks
 * disabled. Translating to hook payloads means one normalizer and one set of
 * rules, whichever way an event arrived.
 *
 * Stateful, no I/O: a tool result names only its `tool_use_id`, so the call's
 * name and input are remembered from the line that asked for it.
 *
 * @typedef {{ agentId: string|null, agentType: string|null }} TranscriptSource
 *   which agent wrote the file: null for the session's main transcript
 * @typedef {{ payload: Record<string, any>, ts: string }} TranslatedHook
 */

const CONVERSATION = Object.freeze(new Set(['user', 'assistant']));

const blocksOf = entry => (Array.isArray(entry.message?.content) ? entry.message.content : []);

const textOf = entry => {
  const content = entry.message?.content;
  if (typeof content === 'string') return content;
  return blocksOf(entry)
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
};

// Slash commands and their echoes are recorded as user lines too; they are
// not something the person asked the agent.
const isCommandEcho = text => /^\s*<(command-|local-command-)/.test(text);

export const TranscriptTranslator = () => {
  const calls = new Map();
  const startedAgents = new Set();
  const stoppedTurns = new Set();
  const subagentByLaunch = new Map();

  /**
   * Remembers which subagent a launching Agent call started, from the
   * subagent's meta file, so the end of that call also ends the subagent.
   *
   * @param {string} toolUseId
   * @param {{ agentId: string, agentType: string|null }} agent
   */
  const linkSubagent = (toolUseId, agent) => subagentByLaunch.set(toolUseId, agent);

  const common = (entry, source) => ({
    session_id: entry.sessionId,
    cwd: entry.cwd,
    ...(source.agentId && { agent_id: source.agentId, agent_type: source.agentType }),
  });

  const subagentStart = (entry, source) => {
    if (!source.agentId || startedAgents.has(source.agentId)) return [];
    startedAgents.add(source.agentId);
    return [{ ...common(entry, source), hook_event_name: 'SubagentStart' }];
  };

  const prompt = (entry, source) => {
    if (source.agentId || entry.isMeta || blocksOf(entry).some(b => b.type === 'tool_result'))
      return [];
    const text = textOf(entry);
    if (!text.trim() || isCommandEcho(text)) return [];
    return [{ ...common(entry, source), hook_event_name: 'UserPromptSubmit', prompt: text }];
  };

  const toolStarts = (entry, source) =>
    blocksOf(entry)
      .filter(block => block.type === 'tool_use')
      .map(block => {
        calls.set(block.id, { name: block.name, input: block.input ?? {} });
        return {
          ...common(entry, source),
          hook_event_name: 'PreToolUse',
          tool_name: block.name,
          tool_input: block.input ?? {},
          tool_use_id: block.id,
        };
      });

  const subagentStop = (entry, toolUseId) => {
    const agent = subagentByLaunch.get(toolUseId);
    if (!agent) return [];
    subagentByLaunch.delete(toolUseId);
    return [
      {
        session_id: entry.sessionId,
        cwd: entry.cwd,
        agent_id: agent.agentId,
        agent_type: agent.agentType,
        hook_event_name: 'SubagentStop',
      },
    ];
  };

  const toolEnds = (entry, source) =>
    blocksOf(entry)
      .filter(block => block.type === 'tool_result')
      .flatMap(block => {
        const call = calls.get(block.tool_use_id) ?? { name: 'unknown', input: {} };
        calls.delete(block.tool_use_id);
        return [
          ...subagentStop(entry, block.tool_use_id),
          {
            ...common(entry, source),
            hook_event_name: block.is_error ? 'PostToolUseFailure' : 'PostToolUse',
            tool_name: call.name,
            tool_input: call.input,
            tool_use_id: block.tool_use_id,
            ...(block.is_error
              ? { error: entry.toolUseResult ?? block.content }
              : { tool_response: entry.toolUseResult ?? block.content }),
          },
        ];
      });

  // One assistant message can be split over several lines (thinking, then
  // text), each carrying the same stop reason: the turn ends once.
  const turnEnd = (entry, source) => {
    const id = entry.message?.id ?? entry.uuid;
    if (source.agentId || entry.message?.stop_reason !== 'end_turn' || stoppedTurns.has(id))
      return [];
    stoppedTurns.add(id);
    return [{ ...common(entry, source), hook_event_name: 'Stop' }];
  };

  const BY_TYPE = Object.freeze({
    user: (entry, source) => [...prompt(entry, source), ...toolEnds(entry, source)],
    assistant: (entry, source) => [...toolStarts(entry, source), ...turnEnd(entry, source)],
  });

  /**
   * @param {Record<string, any>} entry  one parsed transcript line
   * @param {TranscriptSource} source
   * @returns {TranslatedHook[]}
   */
  const translate = (entry, source) => {
    if (!CONVERSATION.has(entry?.type) || !entry.sessionId || !entry.timestamp) return [];

    return [...subagentStart(entry, source), ...BY_TYPE[entry.type](entry, source)].map(
      payload => ({ payload, ts: entry.timestamp })
    );
  };

  return { linkSubagent, translate };
};
