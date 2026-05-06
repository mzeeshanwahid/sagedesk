import type { AgentConfig } from './types';

const DEFAULT_POOL = [
  "That one's a bit outside what I have notes on right now. Feel free to reach out directly and I'll make sure you get a proper answer.",
  "Hmm, I don't have a great answer for that one yet. You're welcome to get in touch and a real person will help.",
  "I want to give you the right answer, not a guess. If you reach out through the contact page someone will follow up with you.",
];

let rotationIndex = 0;

export function getFallback(config: AgentConfig): string {
  const pool =
    config.fallbackPool && config.fallbackPool.length > 0
      ? config.fallbackPool
      : config.fallback
        ? [config.fallback]
        : DEFAULT_POOL;

  const message = pool[rotationIndex % pool.length];
  rotationIndex = (rotationIndex + 1) % pool.length;

  if (config.contactUrl) {
    return `${message} You can reach us at: ${config.contactUrl}`;
  }

  return message;
}
