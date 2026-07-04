import type { Character } from '$lib/types'

export function findCharWithPreset(
    characters: Character[],
    excludeCharId: string,
    presetId: string,
): Character | undefined {
    return characters.find((c) => c.id !== excludeCharId && c.presetId === presetId)
}
