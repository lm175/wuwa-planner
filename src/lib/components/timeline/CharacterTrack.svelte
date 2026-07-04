<script lang="ts">
    import type { Character, KeyOperation, KeyType, KeyMode } from '$lib/types'
    import { planner } from '$lib/stores/planner.svelte'
    import ActionBlockComp from './ActionBlock.svelte'
    import { findSnapTarget } from '$lib/utils/timeline'
    import { notification } from '$lib/stores/notification.svelte'

    let {
        character,
        index: trackIndex,
        selectedKey,
        selectedMode,
        comboA = 0,
        comboB = 0,
        strong = false,
        comment = '',
        oneditBlock,
        oncontextBlock,
        oncloseContext,
    }: {
        character: Character
        index: number
        selectedKey: KeyType
        selectedMode: KeyMode
        comboA?: number
        comboB?: number
        strong?: boolean
        comment?: string
        oneditBlock: (block: any) => void
        oncontextBlock: (block: any, e: MouseEvent) => void
        oncloseContext?: () => void
    } = $props()

    const SNAP_THRESHOLD = 12
    const MIN_BLOCK_X = 4

    let blocks = $derived(planner.getCharacterBlocks(character.id).toSorted((a, b) => a.x - b.x))
    let color = $derived(planner.getTrackColor(character.id, trackIndex).gradient)

    let trackEl = $state<HTMLDivElement | null>(null)
    let isDragOver = $state(false)
    let dragState = $state<{
        blockId: string
        offsetX: number
        snapTargetId: string | null
    } | null>(null)

    function getTrackOffset(): number {
        if (!trackEl) return 0
        return trackEl.getBoundingClientRect().left
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault()
        if (!e.dataTransfer) return
        isDragOver = true
    }

    function handleDragLeave() {
        isDragOver = false
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault()
        isDragOver = false
        const offset = getTrackOffset()

        const contextData = e.dataTransfer?.getData('application/wuwa-keyop-context')
        if (contextData) {
            const { fromBlockId, keyOpIndex, keyOp } = JSON.parse(contextData)
            const srcBlock = planner.blocks.find((b) => b.id === fromBlockId)
            if (!srcBlock || srcBlock.characterId !== character.id) return
            const dropX = Math.max(MIN_BLOCK_X, e.clientX - offset - 24)
            const SHIFT = 60
            const isLeft = dropX < srcBlock.x
            const srcX = srcBlock.x

            const newBlock = planner.addBlock(character.id, isLeft ? srcX : dropX)

            let adjustedIdx = keyOpIndex
            if (srcBlock.isIntro) {
                planner.updateBlock(newBlock.id, {
                    isIntro: true,
                    keyOps: [{ key: 'intro', mode: 'click' }, keyOp],
                })
                const introIdx = srcBlock.keyOps.findIndex((o) => o.key === 'intro')
                if (introIdx >= 0) {
                    planner.removeKeyOp(srcBlock.id, introIdx)
                    if (introIdx < keyOpIndex) adjustedIdx--
                }
                planner.updateBlock(srcBlock.id, { isIntro: false })
            } else {
                planner.addKeyOp(newBlock.id, keyOp)
            }
            planner.removeKeyOp(srcBlock.id, adjustedIdx)

            if (isLeft && planner.blocks.some((b) => b.id === srcBlock.id)) {
                planner.updateBlock(srcBlock.id, { x: srcX + SHIFT })
                planner.addStayFieldMarker(character.id, newBlock.id, srcBlock.id)
            } else if (!isLeft && planner.blocks.some((b) => b.id === srcBlock.id)) {
                planner.addStayFieldMarker(character.id, srcBlock.id, newBlock.id)
            }

            oncloseContext?.()
            return
        }

        const moveData = e.dataTransfer?.getData('application/wuwa-keyop-move')
        if (moveData) {
            const { fromBlockId, keyOp, keyOpIndex } = JSON.parse(moveData)
            const dropX = Math.max(MIN_BLOCK_X, e.clientX - offset - 24)

            const snapTarget = findSnapTarget(blocks, '', dropX, SNAP_THRESHOLD)
            if (snapTarget) {
                planner.removeKeyOp(fromBlockId, keyOpIndex)
                planner.addKeyOp(snapTarget, keyOp)
            } else {
                const newBlock = planner.addBlock(character.id, dropX)
                planner.addKeyOp(newBlock.id, keyOp)
                planner.removeKeyOp(fromBlockId, keyOpIndex)
                if (
                    character.id === planner.blocks.find((b) => b.id === fromBlockId)?.characterId
                ) {
                    planner.addStayFieldMarker(character.id, fromBlockId, newBlock.id)
                }
            }
            return
        }

        const raw = e.dataTransfer?.getData('application/wuwa-keyop')
        if (!raw) return

        const parsed = JSON.parse(raw)
        const keyOp: KeyOperation = { key: parsed.key, mode: parsed.mode }
        const cA = (parsed.comboA as number) || 0
        const cB = (parsed.comboB as number) || 0
        if (cA > 0 && cB > 0) {
            keyOp.comboStart = cA
            keyOp.comboEnd = cB
        }
        if (parsed.strong) keyOp.strong = true
        if (parsed.comment) keyOp.comment = parsed.comment
        const x = Math.max(MIN_BLOCK_X, e.clientX - offset - 24)

        const snapTarget = findSnapTarget(blocks, '', x, SNAP_THRESHOLD)
        if (snapTarget) {
            planner.addKeyOp(snapTarget, keyOp)
        } else {
            const block = planner.addBlock(character.id, x)
            planner.addKeyOp(block.id, keyOp)
        }
    }

    function handleBlockPointerDown(e: PointerEvent, blockId: string) {
        if (e.button !== 0) return
        e.preventDefault()
        const block = planner.blocks.find((b) => b.id === blockId)
        if (!block || !trackEl) return

        const trackRect = trackEl.getBoundingClientRect()
        dragState = {
            blockId,
            offsetX: e.clientX - trackRect.left - block.x,
            snapTargetId: null,
        }

        trackEl.setPointerCapture(e.pointerId)
        trackEl.addEventListener('pointermove', handleTrackPointerMove)
        trackEl.addEventListener('pointerup', handleTrackPointerUp)
    }

    function handleTrackPointerMove(e: PointerEvent) {
        if (!dragState || !trackEl) return
        const trackRect = trackEl.getBoundingClientRect()
        const x = Math.max(MIN_BLOCK_X, e.clientX - trackRect.left - dragState.offsetX)

        const snapId = findSnapTarget(blocks, dragState.blockId, x, SNAP_THRESHOLD)
        if (snapId) {
            const target = planner.blocks.find((b) => b.id === snapId)
            if (target) {
                planner.updateBlock(dragState.blockId, { x: target.x })
                dragState.snapTargetId = snapId
            }
        } else {
            planner.updateBlock(dragState.blockId, { x })
            dragState.snapTargetId = null
        }
    }

    function validateStayFieldMarkers(charId: string) {
        const charBlocks = planner.getCharacterBlocks(charId).toSorted((a, b) => a.x - b.x)
        const validPairs = new Map<string, string>()
        for (let i = 1; i < charBlocks.length; i++) {
            validPairs.set(charBlocks[i].id, charBlocks[i - 1].id)
        }
        const invalid = planner.stayFieldMarkers.filter(
            (m) => m.characterId === charId && validPairs.get(m.toBlockId) !== m.fromBlockId,
        )
        for (const m of invalid) {
            planner.removeStayFieldMarker(m.id)
        }
        if (invalid.length > 0) {
            notification.show(`因拖动调整位置，已自动断开 ${invalid.length} 个留场`)
        }
    }

    function handleTrackPointerUp() {
        if (!dragState || !trackEl) return
        trackEl.removeEventListener('pointermove', handleTrackPointerMove)
        trackEl.removeEventListener('pointerup', handleTrackPointerUp)

        if (dragState.snapTargetId) {
            planner.mergeBlocks(dragState.blockId, dragState.snapTargetId)
        }

        validateStayFieldMarkers(character.id)
        dragState = null
    }

    function handleDblClick(e: MouseEvent) {
        const target = e.target as HTMLElement
        if (target.closest('[data-block-id]')) return
        const offset = getTrackOffset()
        const clickX = Math.max(MIN_BLOCK_X, e.clientX - offset - 24)
        const keyOp: KeyOperation = { key: selectedKey, mode: selectedMode }
        if (comboA > 0 && comboB > 0) {
            keyOp.comboStart = comboA
            keyOp.comboEnd = comboB
        }
        if (strong) keyOp.strong = true
        if (comment) keyOp.comment = comment
        const rightBlock = blocks.find((b) => b.x > clickX)
        const newBlock = planner.addBlock(character.id, clickX)
        planner.addKeyOp(newBlock.id, keyOp)
        if (rightBlock) {
            planner.addStayFieldMarker(character.id, newBlock.id, rightBlock.id)
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    bind:this={trackEl}
    data-track={character.id}
    class={'relative rounded-lg p-2 pl-1 transition-colors ' + (isDragOver ? 'bg-white/5' : '')}
    style="background: {planner.theme.trackBg}; border-left: 3px solid {color}; min-height: 48px;"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    ondblclick={handleDblClick}
>
    <div class="relative" style="min-height: 36px; width: 100%;">
        {#if blocks.length === 0}
            <div
                class="flex h-9 w-full items-center rounded border border-dashed border-zinc-600 pl-2"
            >
                <span class="text-[11px] font-medium text-zinc-400"
                    >从面板拖拽、单击左侧头像或双击空白编辑区域添加操作块</span
                >
            </div>
        {:else}
            {#each blocks as block (block.id)}
                <div
                    class="absolute"
                    style="left: {block.x}px; top: 0;"
                    onpointerdown={(e) => handleBlockPointerDown(e, block.id)}
                >
                    <ActionBlockComp
                        {block}
                        theme={planner.theme}
                        onedit={() => oneditBlock(block)}
                        oncontext={(e) => oncontextBlock(block, e)}
                    />
                </div>
            {/each}
        {/if}
    </div>
</div>
