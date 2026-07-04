import type { ActionBlock, Character, StayFieldMarker } from '$lib/types'

export interface Segment {
    startX: number
    blocks: ActionBlock[]
}

export function getPrevBlock(block: ActionBlock, blocks: ActionBlock[]): ActionBlock | null {
    const charBlocks = blocks
        .filter((b) => b.characterId === block.characterId)
        .toSorted((a, b) => a.x - b.x)
    const idx = charBlocks.findIndex((b) => b.id === block.id)
    if (idx <= 0) return null
    return charBlocks[idx - 1]
}

export function stayFieldWithPrev(
    block: ActionBlock,
    blocks: ActionBlock[],
    markers: StayFieldMarker[],
): boolean {
    const prev = getPrevBlock(block, blocks)
    if (!prev) return false
    return markers.some((m) => m.fromBlockId === prev.id && m.toBlockId === block.id)
}

export function findSnapTarget(
    blocks: ActionBlock[],
    excludeBlockId: string,
    newX: number,
    snapThreshold: number = 12,
): string | null {
    const otherBlocks = blocks.filter((b) => b.id !== excludeBlockId)
    for (const other of otherBlocks) {
        if (Math.abs(other.x - newX) <= snapThreshold) return other.id
    }
    return null
}

export function canBeIntro(block: ActionBlock, blocks: ActionBlock[]): boolean {
    const earlier = blocks.filter((b) => b.x < block.x).toSorted((a, b) => b.x - a.x)
    if (earlier.length === 0) return true
    return earlier[0].characterId !== block.characterId
}

export function computeSegments(
    allBlocks: ActionBlock[],
    containerWidth: number,
    avatarCol: number = 72,
    offset: number = 32,
    minWidth: number = 200,
): Segment[] {
    const all = allBlocks.toSorted((a, b) => a.x - b.x)
    if (all.length === 0) return []
    const segW = Math.max(containerWidth - avatarCol - offset, minWidth)
    const segs: Segment[] = []
    let cur: ActionBlock[] = [],
        curX = all[0].x
    for (const b of all) {
        const comboOps = b.keyOps.filter(
            (o) => o.comboStart && o.comboEnd && o.comboStart > 0 && o.comboEnd > 0,
        ).length
        const estW = b.keyOps.length * 49 + (b.customIcons?.length ?? 0) * 80 + comboOps * 36 + 24
        if (b.x - curX + estW > segW && cur.length > 0) {
            segs.push({ startX: curX, blocks: cur })
            curX = b.x
            cur = [b]
        } else if (b.x - curX >= segW) {
            segs.push({ startX: curX, blocks: cur })
            curX = b.x
            cur = [b]
        } else {
            cur.push(b)
        }
    }
    if (cur.length) segs.push({ startX: curX, blocks: cur })
    return segs
}
