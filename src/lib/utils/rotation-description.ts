import type {
    ActionBlock,
    KeyOperation,
    KeyType,
    KeyMode,
    StayFieldMarker,
    Character,
    CharacterPreset,
} from '$lib/types'
import { resolveTeamAliases } from './resolveTeamAliases'

export interface TimelineItem {
    block: ActionBlock
    alias: string
    charIndex: number
    prevBlock: ActionBlock | null
    isSwitch: boolean
    isSwitchIntro: boolean
    isSwitchStay: boolean
    hasStayField: boolean
}

function resolveCharAliases(
    characters: Character[],
    presets: CharacterPreset[],
): string[] {
    const aliasLists: string[][] = []
    const names: string[] = []
    for (let i = 0; i < characters.length; i++) {
        const char = characters[i]
        const presetId = char?.presetId
        if (!presetId) {
            aliasLists.push([char?.name ?? `角色${i + 1}`])
            names.push(char?.name ?? `角色${i + 1}`)
        } else {
            const preset = presets.find((p) => p.id === presetId)
            if (preset) {
                aliasLists.push([...preset.aliases])
                names.push(preset.name)
            } else {
                aliasLists.push([char?.name ?? `角色${i + 1}`])
                names.push(char?.name ?? `角色${i + 1}`)
            }
        }
    }

    for (let i = 0; i < aliasLists.length; i++) {
        aliasLists[i].push(names[i])
    }

    const aliasCount = new Map<string, number>()
    for (const list of aliasLists) {
        const seen = new Set<string>()
        for (const a of list) {
            if (!seen.has(a)) {
                aliasCount.set(a, (aliasCount.get(a) || 0) + 1)
                seen.add(a)
            }
        }
    }

    for (let i = 0; i < aliasLists.length; i++) {
        const filtered = aliasLists[i].filter(a => aliasCount.get(a) === 1)
        aliasLists[i] = filtered.length > 0 ? filtered : [names[i]]
    }

    return resolveTeamAliases(aliasLists)
}

function keyOpText(op: KeyOperation): string {
    const k = op.key === 'Z' ? 'LMB' : op.key
    const kLabel = k === 'X' ? '下落' : k === 'F' ? '处决' : k
    const m = op.mode

    let base: string
    if (m === 'preinput_swap' || m === 'preinput_action') {
        if (k === 'LMB') base = '预输入Z'
        else if (k === 'RMB') base = '预输入闪'
        else if (k === 'jump') base = '预输入跳'
        else base = '预输入' + kLabel
    } else if (m === 'rapid_click') {
        if (k === 'LMB') base = '狂按a'
        else if (k === 'RMB') base = '狂按闪'
        else if (k === 'jump') base = '狂按跳'
        else base = '狂按' + kLabel
    } else if (m === 'hold') {
        if (k === 'LMB') base = '长按Z'
        else if (k === 'RMB') base = '长按闪'
        else if (k === 'jump') base = '长按跳'
        else base = '长按' + kLabel
    } else {
        if (k === 'LMB') base = 'a'
        else if (k === 'RMB') base = '闪'
        else if (k === 'jump') base = '跳'
        else base = kLabel
    }

    if (op.strong) base = '强' + base

    if (op.comboStart && op.comboEnd && op.comboStart > 0 && op.comboEnd > 0) {
        if (op.comboStart === op.comboEnd) base = base + String(op.comboStart)
        else {
            const nums: number[] = []
            for (let n = op.comboStart; n <= op.comboEnd; n++) nums.push(n)
            base = base + nums.join('')
        }
    }

    if (op.comment) base += '(' + op.comment + ')'

    return base
}

function hasStayField(
    block: ActionBlock,
    allBlocks: ActionBlock[],
    markers: StayFieldMarker[],
): boolean {
    const charBlocks = allBlocks
        .filter((b) => b.characterId === block.characterId)
        .sort((a, b) => a.x - b.x)
    const idx = charBlocks.findIndex((b) => b.id === block.id)
    if (idx <= 0) return false
    const prevBlock = charBlocks[idx - 1]
    return markers.some(
        (m) => m.fromBlockId === prevBlock.id && m.toBlockId === block.id,
    )
}

export function getMergedTimeline(
    characters: Character[],
    blocks: ActionBlock[],
    markers: StayFieldMarker[],
    presets: CharacterPreset[],
): TimelineItem[] {
    const resolvedAliases = resolveCharAliases(characters, presets)

    const all = blocks
        .map((block) => {
            const charIdx = characters.findIndex(
                (c) => c.id === block.characterId,
            )
            return {
                block,
                alias: resolvedAliases[charIdx] ?? `角色${charIdx + 1}`,
                charIndex: charIdx,
            }
        })
        .sort((a, b) => a.block.x - b.block.x)

    const result: TimelineItem[] = []
    for (let i = 0; i < all.length; i++) {
        const { block, alias, charIndex } = all[i]
        const prevBlock = i > 0 ? all[i - 1].block : null
        const isSwitch =
            prevBlock !== null && prevBlock.characterId !== block.characterId
        const stay = hasStayField(block, blocks, markers)
        result.push({
            block,
            alias,
            charIndex,
            prevBlock,
            isSwitch,
            isSwitchIntro: isSwitch && block.isIntro,
            isSwitchStay: isSwitch && !block.isIntro && stay,
            hasStayField: stay,
        })
    }
    return result
}

export function buildTextDescription(items: TimelineItem[]): string {
    const parts: string[] = []
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const ops = opsText(item.block.keyOps, hasStrongIntro(item.block.keyOps))
        if (i === 0) {
            parts.push(`${item.alias}${ops}`)
        } else if (item.block.characterId === items[i - 1].block.characterId) {
            parts.push(ops)
        } else if (item.isSwitchIntro) {
            parts.push(`，延奏${item.alias}${ops}`)
        } else if (item.isSwitchStay) {
            parts.push(`，切回${item.alias}${ops}`)
        } else {
            parts.push(`，${item.alias}${ops}`)
        }
    }
    return parts.join('')
}

function visibleOps(ops: KeyOperation[]): KeyOperation[] {
    return ops.filter((op) => op.key !== 'intro' && op.key !== 'V')
}

function hasStrongIntro(ops: KeyOperation[]): boolean {
    return ops.some((op) => op.key === 'intro' && op.strong)
}

function opsText(ops: KeyOperation[], strongIntro = false): string {
    const s = visibleOps(ops)
        .map(keyOpText)
        .join('-')
        .replace(/\)-/g, ') ')
        .replace(/-\(/g, ' (')
    const prefix = strongIntro ? '强变' : ''
    if (!s && !prefix) return ''
    return ' ' + prefix + s
}

export function buildCharLines(
    characters: Character[],
    items: TimelineItem[],
    presets: CharacterPreset[],
): string {
    const resolvedAliases = resolveCharAliases(characters, presets)
    const lines: string[] = []
    for (let ci = 0; ci < characters.length; ci++) {
        const charItems = items.filter((it) => it.charIndex === ci)
        if (charItems.length === 0) continue
        const alias = resolvedAliases[ci]
        const ops = charItems
            .map((it, i) => {
                const opStr = opsText(it.block.keyOps, hasStrongIntro(it.block.keyOps))
                if (i === 0) return opStr
                if (it.isSwitchIntro) return `，延奏${alias}${opStr}`
                if (it.isSwitchStay) return `，切回${alias}${opStr}`
                if (it.block.characterId !== charItems[i - 1].block.characterId)
                    return `，${alias}${opStr}`
                return opStr
            })
            .join('')
        lines.push(`${alias}：${ops}`)
    }
    return lines.join('\n')
}

export function buildIntroLines(items: TimelineItem[]): string {
    const segments: string[] = []
    let current: string[] = []
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const opStr = opsText(item.block.keyOps, hasStrongIntro(item.block.keyOps))
        const prev = i > 0 ? items[i - 1] : null
        if (item.isSwitchIntro) {
            if (current.length > 0) segments.push(current.join(''))
            current = [`延奏${item.alias}${opStr}`]
        } else if (current.length === 0) {
            current.push(`${item.alias}${opStr}`)
        } else if (prev && item.block.characterId === prev.block.characterId) {
            current.push(opStr)
        } else if (prev && item.isSwitchStay) {
            current.push(`，切回${item.alias}${opStr}`)
        } else {
            current.push(`，${item.alias}${opStr}`)
        }
    }
    if (current.length > 0) segments.push(current.join(''))
    return segments.join('\n')
}
