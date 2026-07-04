<script lang="ts">
    import { scale } from 'svelte/transition'
    import type { ActionBlock, KeyOperation } from '$lib/types'
    import { MODE_LABELS } from '$lib/data/labels'
    import { planner } from '$lib/stores/planner.svelte'
    import KeyIcon from './KeyIcon.svelte'
    import ComboNumbers from './ComboNumbers.svelte'
    import StrongBadge from './StrongBadge.svelte'

    let {
        contextBlock,
        contextPos,
        hasPrev,
        stayFieldActive,
        canToggleIntro,
        onToggleStayField,
        onToggleIntro,
        onToggleOffHand,
        onDeleteBlock,
        onReorderKeyOps,
        onToggleIntroStrong,
        onClose,
    }: {
        contextBlock: ActionBlock | null
        contextPos: { x: number; y: number }
        hasPrev: boolean
        stayFieldActive: boolean
        canToggleIntro: boolean
        onToggleStayField: (block: ActionBlock) => void
        onToggleIntro: (block: ActionBlock) => void
        onToggleOffHand: (block: ActionBlock) => void
        onDeleteBlock: (blockId: string) => void
        onReorderKeyOps: (
            blockId: string,
            keyOps: KeyOperation[],
            updatedBlock: ActionBlock | null,
        ) => void
        onToggleIntroStrong: (blockId: string) => void
        onClose: () => void
    } = $props()

    let ref = $state<HTMLDivElement>()
    let adjX = $state(0)
    let adjY = $state(0)

    $effect(() => {
        if (contextPos.x <= 0 || contextPos.y <= 0) {
            adjX = 0
            adjY = 0
            return
        }
        adjX = contextPos.x
        adjY = contextPos.y
        requestAnimationFrame(() => {
            if (!ref) return
            const r = ref.getBoundingClientRect()
            adjX = Math.max(4, Math.min(contextPos.x, innerWidth - r.width - 4))
            adjY = Math.max(4, Math.min(contextPos.y, innerHeight - r.height - 4))
        })
    })
</script>

{#if contextBlock}
    <div
        bind:this={ref}
        class="fixed z-50 min-w-52 rounded-lg py-1.5 shadow-xl"
        style="left: {adjX}px; top: {adjY}px; border: 1px solid {planner.theme
            .contextBorder}; background: {planner.theme.contextBg};"
        transition:scale={{ duration: 100, start: 0.95 }}
    >
        {#if contextBlock.keyOps.length > 0}
            <div style="border-bottom: 1px solid {planner.theme.divider};">
                <div class="px-2 pt-1.5 pb-1">
                    <div
                        class="mb-1 px-1 text-xs font-semibold"
                        style="color: {planner.theme.textSecondary};"
                    >
                        操作列表
                    </div>
                </div>
                <div class="max-h-56 overflow-y-auto scrollbar-dark-thick px-2 pb-1.5">
                    {#each contextBlock.keyOps as op, i}
                        {#if op.key !== 'intro'}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                draggable="true"
                                class="flex w-full cursor-default items-center gap-1.5 rounded px-1.5 py-1"
                                style="color: {planner.theme.textSecondary};"
                                onmouseenter={(e) =>
                                    ((e.currentTarget as HTMLElement).style.background =
                                        planner.theme.contextHover)}
                                onmouseleave={(e) =>
                                    ((e.currentTarget as HTMLElement).style.background = '')}
                                ondragstart={(e) => {
                                    const data = JSON.stringify({
                                        fromBlockId: contextBlock!.id,
                                        keyOpIndex: i,
                                        keyOp: op,
                                    })
                                    e.dataTransfer!.setData('application/wuwa-keyop-context', data)
                                    e.dataTransfer!.effectAllowed = 'move'
                                    ;(e.currentTarget as HTMLElement).style.opacity = '0.4'
                                }}
                                ondragend={(e) => {
                                    ;(e.currentTarget as HTMLElement).style.opacity = '1'
                                }}
                                ondragover={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    e.dataTransfer!.dropEffect = 'move'
                                }}
                                ondrop={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    const raw = e.dataTransfer!.getData(
                                        'application/wuwa-keyop-context',
                                    )
                                    if (!raw) return
                                    const parsed = JSON.parse(raw)
                                    const fromBlockId = parsed.fromBlockId
                                    const keyOpIndex = parsed.keyOpIndex
                                    if (fromBlockId !== contextBlock!.id || keyOpIndex === i) return
                                    const ops = [...contextBlock!.keyOps]
                                    const [moved] = ops.splice(keyOpIndex, 1)
                                    ops.splice(i, 0, moved)
                                    onReorderKeyOps(contextBlock!.id, ops, null)
                                }}
                            >
                                <span
                                    class="cursor-grab active:cursor-grabbing"
                                    style="color: {planner.theme.mutedText};">⠿</span
                                >
                                <span class="inline-flex items-center relative">
                                    {#if op.strong}
                                        <div class="absolute -left-1.5 -top-3 z-10">
                                            <StrongBadge size={10} />
                                        </div>
                                    {/if}
                                    <KeyIcon
                                        key={op.key}
                                        size="sm"
                                        color={planner.theme.nodeColors[op.key]}
                                        mode={op.mode}
                                    />
                                </span>
                                {#if op.comboStart && op.comboEnd && op.comboStart > 0 && op.comboEnd > 0}
                                    <ComboNumbers
                                        start={op.comboStart}
                                        end={op.comboEnd}
                                        theme={planner.theme}
                                    />
                                {/if}
                                {#if op.comment}
                                    <span
                                        class="text-[10px] ml-0.5 rounded px-1"
                                        style="background: {planner.theme.tagBg}; color: {planner
                                            .theme.tagText};">{op.comment}</span
                                    >
                                {/if}
                                <span
                                    class="flex-1 text-xs"
                                    style="color: {planner.theme.textSecondary};"
                                >
                                    {MODE_LABELS[op.mode] || '单击'}
                                </span>
                                <button
                                    class="flex h-5 w-5 items-center justify-center rounded text-[10px]"
                                    style="border: 1px solid {planner.theme
                                        .deleteBtnBorder}; color: {planner.theme.textSecondary};"
                                    onmouseenter={(e) =>
                                        ((e.currentTarget as HTMLElement).style.background =
                                            planner.theme.deleteBtnHover)}
                                    onmouseleave={(e) =>
                                        ((e.currentTarget as HTMLElement).style.background = '')}
                                    onclick={(e) => {
                                        e.stopPropagation()
                                        planner.removeKeyOp(contextBlock!.id, i)
                                        onClose()
                                    }}>✕</button
                                >
                            </div>
                        {/if}
                    {/each}
                    {#if contextBlock.keyOps.some((op) => op.key === 'intro')}
                        <div
                            class="flex items-center justify-between gap-1.5 px-1.5 py-1"
                            style="color: {planner.theme.accentText};"
                        >
                            <div class="flex items-center gap-1.5">
                                <KeyIcon
                                    key="intro"
                                    size="sm"
                                    color={planner.theme.nodeColors.intro}
                                />
                                <span class="text-xs">变奏入场</span>
                            </div>
                            <button
                                class="rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                                style="border-color: {planner.theme.border}; color: {planner.theme
                                    .textSecondary};"
                                onmouseenter={(e) => {
                                    ;(e.currentTarget as HTMLElement).style.background =
                                        planner.theme.buttonHover
                                }}
                                onmouseleave={(e) => {
                                    ;(e.currentTarget as HTMLElement).style.background = ''
                                }}
                                onclick={(e) => {
                                    e.stopPropagation()
                                    onToggleIntroStrong(contextBlock!.id)
                                }}
                            >
                                {contextBlock.keyOps.find((o) => o.key === 'intro')?.strong
                                    ? '设为普通变奏'
                                    : '设为强化变奏'}
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <button
            class="flex w-full items-center px-4 py-2 text-left text-xs"
            style="color: {!hasPrev
                ? planner.theme.mutedText
                : stayFieldActive
                  ? planner.theme.dangerText
                  : planner.theme.accentText}; cursor: {!hasPrev ? 'not-allowed' : 'pointer'};"
            disabled={!hasPrev}
            onmouseenter={(e) => {
                if (hasPrev)
                    (e.currentTarget as HTMLElement).style.background = planner.theme.accentHover
            }}
            onmouseleave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = ''
            }}
            onclick={() => {
                onToggleStayField(contextBlock!)
                onClose()
            }}
        >
            {stayFieldActive ? '清除与上一个块之间的留场' : '与上一个块建立留场'}
        </button>

        <button
            class="flex w-full items-center px-4 py-2 text-left text-xs"
            style="color: {!canToggleIntro
                ? planner.theme.mutedText
                : contextBlock.isIntro
                  ? '#f59e0b'
                  : planner.theme.accentText}; cursor: {!canToggleIntro
                ? 'not-allowed'
                : 'pointer'};"
            disabled={!canToggleIntro}
            onmouseenter={(e) => {
                if (canToggleIntro)
                    (e.currentTarget as HTMLElement).style.background = planner.theme.accentHover
            }}
            onmouseleave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = ''
            }}
            onclick={() => {
                onToggleIntro(contextBlock!)
                onClose()
            }}
        >
            {contextBlock.isIntro ? '取消变奏入场' : '设为变奏入场'}
        </button>

        <button
            class="flex w-full items-center px-4 py-2 text-left text-xs"
            style="color: {!stayFieldActive
                ? planner.theme.mutedText
                : contextBlock.isOffHand
                  ? '#f59e0b'
                  : planner.theme.accentText}; cursor: {!stayFieldActive
                ? 'not-allowed'
                : 'pointer'};"
            disabled={!stayFieldActive}
            onmouseenter={(e) => {
                if (stayFieldActive)
                    (e.currentTarget as HTMLElement).style.background = planner.theme.accentHover
            }}
            onmouseleave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = ''
            }}
            onclick={() => {
                onToggleOffHand(contextBlock!)
                onClose()
            }}
        >
            {contextBlock.isOffHand ? '取消脱手' : '设为脱手'}
        </button>

        <div style="border-top: 1px solid {planner.theme.divider};"></div>

        <button
            class="flex w-full items-center px-4 py-2 text-left text-xs"
            style="color: {planner.theme.dangerText};"
            onmouseenter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = planner.theme.dangerHover)}
            onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
            onclick={() => {
                onDeleteBlock(contextBlock!.id)
                onClose()
            }}>删除操作块</button
        >
    </div>
{/if}
