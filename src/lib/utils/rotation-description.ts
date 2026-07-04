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

function resolveCharAliases(characters: Character[], presets: CharacterPreset[]): string[] {
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
        const filtered = aliasLists[i].filter((a) => aliasCount.get(a) === 1)
        aliasLists[i] = filtered.length > 0 ? filtered : [names[i]]
    }

    return resolveTeamAliases(aliasLists)
}

function keyOpText(op: KeyOperation): string {
    const k = op.key
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
        if (k === 'LMB') base = 'Z'
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
    return markers.some((m) => m.fromBlockId === prevBlock.id && m.toBlockId === block.id)
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
            const charIdx = characters.findIndex((c) => c.id === block.characterId)
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
        const isSwitch = prevBlock !== null && prevBlock.characterId !== block.characterId
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

function buildTextParts(items: TimelineItem[]): string[] {
    const parts: string[] = []
    const lastCharIdx = new Map<string, number>()
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const ops = opsText(item.block.keyOps, hasStrongIntro(item.block.keyOps))
        if (!ops && hasOnlyEmptyOps(item.block.keyOps)) {
            if (i === 0) {
                parts.push(`${item.alias}先手`)
            } else if (item.isSwitchIntro) {
                parts.push(`，延奏${item.alias}`)
            } else if (item.isSwitchStay) {
                parts.push(`，切回${item.alias}`)
            } else {
                parts.push(`，切${item.alias}`)
            }
            lastCharIdx.set(item.block.characterId, parts.length - 1)
            continue
        }
        if (!ops) continue
        if (i === 0) {
            parts.push(`${item.alias}${ops}`)
            lastCharIdx.set(item.block.characterId, parts.length - 1)
        } else if (item.block.isOffHand) {
            const idx = lastCharIdx.get(item.block.characterId)
            if (idx !== undefined) {
                parts[idx] += ops
            } else {
                lastCharIdx.set(item.block.characterId, parts.length)
                parts.push(`${item.alias}${ops}`)
            }
        } else if (item.block.characterId === items[i - 1].block.characterId) {
            parts.push(ops)
        } else if (item.isSwitchIntro) {
            parts.push(`，延奏${item.alias}${ops}`)
            lastCharIdx.set(item.block.characterId, parts.length - 1)
        } else if (item.isSwitchStay) {
            parts.push(`，切回${item.alias}${ops}`)
            lastCharIdx.set(item.block.characterId, parts.length - 1)
        } else {
            parts.push(`，${item.alias}${ops}`)
            lastCharIdx.set(item.block.characterId, parts.length - 1)
        }
    }
    return parts
}

export function buildTextDescription(items: TimelineItem[]): string {
    return buildTextParts(items).join('')
}

export function buildCharLines(items: TimelineItem[]): string {
    return buildTextParts(items)
        .map((p) => p.replace(/^，/, ''))
        .join('\n')
}

function visibleOps(ops: KeyOperation[]): KeyOperation[] {
    return ops.filter((op) => op.key !== 'intro' && op.key !== 'V')
}

function hasStrongIntro(ops: KeyOperation[]): boolean {
    return ops.some((op) => op.key === 'intro' && op.strong)
}

function hasOnlyEmptyOps(ops: KeyOperation[]): boolean {
    const nonIntro = ops.filter((op) => op.key !== 'intro')
    return nonIntro.length > 0 && nonIntro.every((op) => op.key === 'V')
}

function opsText(ops: KeyOperation[], strongIntro = false): string {
    const texts = visibleOps(ops).map(keyOpText)
    const parts: string[] = []
    let i = 0
    while (i < texts.length) {
        const cur = texts[i]
        let j = i + 1
        while (j < texts.length && texts[j] === cur) j++
        parts.push(j - i > 1 ? cur.repeat(j - i) : cur)
        i = j
    }
    const s = parts.join(' ')
    const prefix = strongIntro ? '强变' : ''
    if (!s && !prefix) return ''
    return ' ' + prefix + s
}

export function buildIntroLines(items: TimelineItem[]): string {
    const segments: { text: string; charId: string }[] = []
    let current: string[] = []
    let currentCharId = ''
    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        let opStr = opsText(item.block.keyOps, hasStrongIntro(item.block.keyOps))
        if (!opStr && hasOnlyEmptyOps(item.block.keyOps)) {
            opStr = '先手'
        }
        const prev = i > 0 ? items[i - 1] : null
        if (item.block.isOffHand) {
            for (let s = segments.length - 1; s >= 0; s--) {
                if (segments[s].charId === item.block.characterId) {
                    segments[s].text += opStr
                    break
                }
            }
            continue
        }
        if (item.isSwitchIntro) {
            if (current.length > 0) segments.push({ text: current.join(''), charId: currentCharId })
            current = [`延奏${item.alias}${opStr}`]
            currentCharId = item.block.characterId
        } else if (current.length === 0) {
            current.push(`${item.alias}${opStr}`)
            currentCharId = item.block.characterId
        } else if (prev && item.block.characterId === prev.block.characterId) {
            current.push(opStr)
        } else if (prev && item.isSwitchStay) {
            current.push(`，切回${item.alias}${opStr}`)
            currentCharId = item.block.characterId
        } else {
            current.push(`，${item.alias}${opStr}`)
            currentCharId = item.block.characterId
        }
    }
    if (current.length > 0) segments.push({ text: current.join(''), charId: currentCharId })
    return segments.map((s) => s.text).join('\n')
}
