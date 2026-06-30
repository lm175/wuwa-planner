<script lang="ts">
    import { onMount } from 'svelte'
    import type { ActionBlock, Theme } from '$lib/types'
    import KeyOperationComp from './KeyOperation.svelte'
    import ComboNumbers from './ComboNumbers.svelte'
    import { planner } from '$lib/stores/planner.svelte'

    let {
        block,
        theme,
        onedit,
        oncontext,
        compact = false,
    }: {
        block: ActionBlock
        theme: Theme
        onedit?: () => void
        oncontext?: (e: MouseEvent) => void
        compact?: boolean
    } = $props()

    let isTouch = $state(false)

    onMount(() => {
        isTouch = 'ontouchstart' in window
    })

    function handleOpDragStart(e: DragEvent, idx: number) {
        const op = block.keyOps[idx]
        const moveData = JSON.stringify({
            fromBlockId: block.id,
            keyOp: op,
            keyOpIndex: idx,
        })
        const reorderData = JSON.stringify({
            fromIndex: idx,
            blockId: block.id,
        })
        e.dataTransfer!.setData('application/wuwa-keyop-move', moveData)
        e.dataTransfer!.setData('application/wuwa-op-reorder', reorderData)
        e.dataTransfer!.effectAllowed = 'move'
    }

    function handleOpDrop(e: DragEvent, toIdx: number) {
        e.preventDefault()
        const raw = e.dataTransfer?.getData('application/wuwa-op-reorder')
        if (!raw) return
        const { fromIndex, blockId } = JSON.parse(raw)
        if (blockId !== block.id || fromIndex === toIdx) return
        const ops = [...block.keyOps]
        const [moved] = ops.splice(fromIndex, 1)
        ops.splice(toIdx, 0, moved)
        planner.updateBlock(block.id, { keyOps: ops })
    }
</script>

<div
    data-block-id={block.id}
    data-char-id={block.characterId}
    class="group relative inline-flex cursor-pointer flex-col items-center rounded-md border {(
        compact
    ) ?
        'px-0.5 py-0 gap-0'
    :   'px-1.5 py-1 gap-1'}"
    style="
		border-color: {compact ? theme.blockCompactBorder : theme.blockBorder};
		background: {compact ? theme.blockCompactBg : theme.trackBg};
		min-width: {compact ? '0' : '32px'};
		{block.isIntro ? `border-style: dashed;` : ''}
	"
    role="button"
    tabindex="0"
    ondblclick={isTouch ? oncontext : onedit}
    oncontextmenu={oncontext}
>
    {#if block.keyOps.length > 0}
        <div
            class="flex flex-wrap items-center {compact ? 'gap-0' : (
                'gap-0.5'
            )} transition-all duration-150"
        >
            {#each block.keyOps as op, i (op.key + op.mode + i)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    draggable="true"
                    ondragstart={(e) => handleOpDragStart(e, i)}
                    ondragover={(e) => e.preventDefault()}
                    ondrop={(e) => handleOpDrop(e, i)}
                    class="flex items-center"
                >
                    <KeyOperationComp {op} {theme} draggable={true} />
                </div>
                {#if op.comment}
                    <span
                        class="text-[10px] font-medium whitespace-nowrap rounded px-1"
                        style="background: {theme.key === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}; color: {theme.key === 'light' ? '#000000' : '#ffffff'};"
                    >{op.comment}</span
                    >
                {/if}
                {#if op.comboStart && op.comboEnd && op.comboStart > 0 && op.comboEnd > 0}
                    <ComboNumbers start={op.comboStart} end={op.comboEnd} {theme} />
                {/if}
            {/each}
        </div>
    {/if}
</div>
