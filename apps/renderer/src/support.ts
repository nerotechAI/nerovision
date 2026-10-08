import type { SceneType, Timeline } from '@nero/schemas';

/** Scene types with a real implementation in scenes/. Everything else renders the fallback scene. */
export const SUPPORTED_SCENE_TYPES: readonly SceneType[] = [
  'chapter_card',
  'neural_network',
  'particle_field',
  'futuristic_interface',
  'parallax_25d',
  'typography',
];

export const FALLBACK_SCENE_TYPE: SceneType = 'particle_field';

export function isSupported(type: SceneType): boolean {
  return SUPPORTED_SCENE_TYPES.includes(type);
}

/** Scene ids whose type is not implemented yet, so callers can warn instead of rendering silently. */
export function unsupportedScenes(timeline: Timeline): { id: string; type: SceneType }[] {
  return timeline.scenes.filter((s) => !isSupported(s.type)).map((s) => ({ id: s.id, type: s.type }));
}
