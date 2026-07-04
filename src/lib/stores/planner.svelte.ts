import { getDefaultTheme, ELEMENT_GRADIENTS, ELEMENT_BORDER_COLORS } from '../data/themes'
import { getCharacterPresets } from '../data/characters'
import { themeStore } from './themes.svelte'
import type {
    Character,
    ActionBlock,
    KeyOperation,
    StayFieldMarker,
    Theme,
    RotationExport,
    ElementType,
} from '../types'
import type { ProjectData } from '../types/project'
import { generateId } from '../utils/id'

function createPlannerStore() {
    let characters = $state<Character[]>([
        { id: generateId(), name: '角色1', presetId: null },
        { id: generateId(), name: '角色2', presetId: null },
        { id: generateId(), name: '角色3', presetId: null },
    ])

    let blocks = $state<ActionBlock[]>([])
    let stayFieldMarkers = $state<StayFieldMarker[]>([])
    let theme = $derived(themeStore.getActiveTheme())
    let selectedBlockId = $state<string | null>(null)
    let title = $state<string>('未命名轴')
    let description = $state<string>('')

    function getCharacterBlocks(charId: string): ActionBlock[] {
        return blocks.filter((b) => b.characterId === charId)
    }

    function getPrevCharId(charId: string): string | null {
        const idx = characters.findIndex((c) => c.id === charId)
        if (idx < 0) return null
        return characters[(idx - 1 + characters.length) % characters.length].id
    }

    function updateIntroFlags() {}

    function getBlock(blockId: string) {
        return blocks.find((b) => b.id === blockId)
    }

    function addBlock(charId: string, x: number): ActionBlock {
        const block: ActionBlock = {
            id: generateId(),
            characterId: charId,
            label: '',
            x,
            isIntro: false,
            introOverride: null,
            isOffHand: false,
            keyOps: [],
            customIcons: [],
        }
        blocks = [...blocks, block]
        updateIntroFlags()
        return block
    }

    function addKeyOp(blockId: string, keyOp: KeyOperation) {
        blocks = blocks.map((b) => {
            if (b.id !== blockId) return b
            return { ...b, keyOps: [...b.keyOps, keyOp] }
        })
    }

    function removeKeyOp(blockId: string, index: number) {
        blocks = blocks.map((b) => {
            if (b.id !== blockId) return b
            const newOps = [...b.keyOps]
            newOps.splice(index, 1)
            return { ...b, keyOps: newOps }
        })
        const block = blocks.find((b) => b.id === blockId)
        if (block && block.keyOps.length === 0 && block.customIcons.length === 0) {
            removeBlock(blockId)
        }
    }

    function updateBlock(blockId: string, partial: Partial<ActionBlock>) {
        blocks = blocks.map((b) => (b.id === blockId ? { ...b, ...partial } : b))
    }

    function mergeBlocks(srcId: string, targetId: string) {
        const src = blocks.find((b) => b.id === srcId)
        const target = blocks.find((b) => b.id === targetId)
        if (!src || !target) return
        blocks = blocks.map((b) => {
            if (b.id === targetId) return { ...b, keyOps: [...b.keyOps, ...src.keyOps] }
            return b
        })
        removeBlock(srcId)
    }

    function removeBlock(blockId: string) {
        blocks = blocks.filter((b) => b.id !== blockId)
        stayFieldMarkers = stayFieldMarkers.filter(
            (m) => m.fromBlockId !== blockId && m.toBlockId !== blockId,
        )
        updateIntroFlags()
    }

    function addStayFieldMarker(
        charId: string,
        fromBlockId: string,
        toBlockId: string,
    ): StayFieldMarker {
        const existing = stayFieldMarkers.find(
            (m) => m.fromBlockId === fromBlockId && m.toBlockId === toBlockId,
        )
        if (existing) return existing
        const marker: StayFieldMarker = {
            id: generateId(),
            characterId: charId,
            fromBlockId,
            toBlockId,
        }
        stayFieldMarkers = [...stayFieldMarkers, marker]
        return marker
    }

    function removeStayFieldMarker(markerId: string) {
        stayFieldMarkers = stayFieldMarkers.filter((m) => m.id !== markerId)
    }

    function toggleStayField(blockId: string) {
        const block = blocks.find((b) => b.id === blockId)
        if (!block) return
        const charBlocks = getCharacterBlocks(block.characterId).toSorted((a, b) => a.x - b.x)
        const idx = charBlocks.findIndex((b) => b.id === blockId)
        if (idx <= 0) return
        const prevBlock = charBlocks[idx - 1]
        const existing = stayFieldMarkers.find(
            (m) => m.fromBlockId === prevBlock.id && m.toBlockId === blockId,
        )
        if (existing) {
            stayFieldMarkers = stayFieldMarkers.filter((m) => m.id !== existing.id)
        } else {
            addStayFieldMarker(block.characterId, prevBlock.id, blockId)
        }
    }

    function toggleIntro(blockId: string) {
        const block = blocks.find((b) => b.id === blockId)
        if (!block) return
        const newVal = !block.isIntro
        blocks = blocks.map((b) => {
            if (b.id !== blockId) return b
            const updated = {
                ...b,
                isIntro: newVal,
                introOverride: newVal,
                isOffHand: newVal ? false : b.isOffHand,
            }
            if (newVal) {
                stayFieldMarkers = stayFieldMarkers.filter(
                    (m) => m.fromBlockId !== b.id && m.toBlockId !== b.id,
                )
            }
            return updated
        })
    }

    function moveKeyOpToNewBlock(srcBlockId: string, opIndex: number, charId: string, x: number) {
        const srcBlock = blocks.find((b) => b.id === srcBlockId)
        if (!srcBlock || opIndex >= srcBlock.keyOps.length) return null
        const keyOp = srcBlock.keyOps[opIndex]
        removeKeyOp(srcBlockId, opIndex)
        const newBlock = addBlock(charId, x)
        addKeyOp(newBlock.id, keyOp)
        addStayFieldMarker(charId, srcBlockId, newBlock.id)
        return newBlock
    }

    function updateCharacter(charId: string, partial: Partial<Character>) {
        characters = characters.map((c) => (c.id === charId ? { ...c, ...partial } : c))
    }

    function swapCharacterPresets(srcId: string, targetId: string) {
        const src = characters.find((c) => c.id === srcId)
        const target = characters.find((c) => c.id === targetId)
        if (!src || !target) return
        characters = characters.map((c) => {
            if (c.id === srcId) return { ...c, presetId: target.presetId, name: target.name }
            if (c.id === targetId) return { ...c, presetId: src.presetId, name: src.name }
            return c
        })
        blocks = blocks.map((b) => {
            if (b.characterId === srcId) return { ...b, characterId: targetId }
            if (b.characterId === targetId) return { ...b, characterId: srcId }
            return b
        })
        stayFieldMarkers = stayFieldMarkers.map((m) => {
            if (m.characterId === srcId) return { ...m, characterId: targetId }
            if (m.characterId === targetId) return { ...m, characterId: srcId }
            return m
        })
    }

    function selectBlock(blockId: string | null) {
        selectedBlockId = blockId
    }

    function importRotation(data: RotationExport) {
        characters = data.team
        blocks = data.rotation.blocks.map((b) => ({
            ...b,
            introOverride: b.introOverride ?? null,
        }))
        stayFieldMarkers = data.rotation.stayFieldMarkers
        title = data.metadata.title
        description = data.metadata.description
        updateIntroFlags()
    }

    function exportRotation(): RotationExport {
        return {
            version: '1.0' as const,
            metadata: {
                title,
                description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            team: characters,
            rotation: {
                blocks,
                stayFieldMarkers,
            },
        }
    }

    function toProjectData(): ProjectData {
        return {
            id: '',
            title: title,
            characters: characters.map((c) => ({ ...c })),
            blocks: blocks.map((b) => ({
                ...b,
                keyOps: b.keyOps.map((o) => ({ ...o })),
            })),
            stayFieldMarkers: stayFieldMarkers.map((m) => ({ ...m })),
            description,
            createdAt: '',
            updatedAt: new Date().toISOString(),
        }
    }

    function loadFromProjectData(data: ProjectData) {
        characters = data.characters.map((c) => ({ ...c }))
        blocks = data.blocks.map((b) => ({
            ...b,
            introOverride: b.introOverride ?? null,
        }))
        stayFieldMarkers = data.stayFieldMarkers.map((m) => ({ ...m }))
        title = data.title
        description = data.description
        selectedBlockId = null
        updateIntroFlags()
        _defaultsInited = true
    }

    function getTrackColor(
        charId: string,
        slotIndex: number,
    ): { gradient: string; border: string } {
        const ft = theme.fallbackTrack
        const char = characters.find((c) => c.id === charId)
        if (!char?.presetId) return { gradient: ft, border: ft }
        const preset = getCharacterPresets().find((p) => p.id === char.presetId)
        if (!preset) return { gradient: ft, border: ft }
        const element = preset.element
        const idx = Math.min(slotIndex, 2)
        return {
            gradient: (ELEMENT_GRADIENTS[element] ?? [ft])[idx],
            border: (ELEMENT_BORDER_COLORS[element] ?? [ft])[idx],
        }
    }

    let _defaultsInited = false

    function initDefaults() {
        if (_defaultsInited) return
        _defaultsInited = true
        const presets = getCharacterPresets()
        const ids = ['piaoBoZheYanMie', 'sanHua', 'weiLiNai']
        ids.forEach((pid, i) => {
            const p = presets.find((pr) => pr.id === pid)
            if (p) {
                characters[i] = {
                    ...characters[i],
                    name: p.name,
                    presetId: p.id,
                }
            }
        })
    }

    function reset() {
        _defaultsInited = false
        characters = [
            { id: generateId(), name: '角色1', presetId: null },
            { id: generateId(), name: '角色2', presetId: null },
            { id: generateId(), name: '角色3', presetId: null },
        ]
        blocks = []
        stayFieldMarkers = []
        selectedBlockId = null
        title = '未命名轴'
        description = ''
    }

    function setTheme(id: string) {
        themeStore.setActiveTheme(id)
    }

    return {
        get characters() {
            return characters
        },
        get blocks() {
            return blocks
        },
        get stayFieldMarkers() {
            return stayFieldMarkers
        },
        get theme() {
            return theme
        },
        get selectedBlockId() {
            return selectedBlockId
        },
        get title() {
            return title
        },
        get description() {
            return description
        },
        set title(v: string) {
            title = v
        },
        set description(v: string) {
            description = v
        },
        set characters(v: Character[]) {
            characters = v
        },
        getCharacterBlocks,
        getTrackColor,
        initDefaults,
        addBlock,
        addKeyOp,
        removeKeyOp,
        updateBlock,
        mergeBlocks,
        removeBlock,
        addStayFieldMarker,
        removeStayFieldMarker,
        toggleStayField,
        toggleIntro,
        moveKeyOpToNewBlock,
        updateCharacter,
        swapCharacterPresets,
        selectBlock,
        importRotation,
        exportRotation,
        toProjectData,
        loadFromProjectData,
        setTheme,
        reset,
    }
}

export const planner = createPlannerStore()
