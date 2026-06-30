<script lang="ts">
    import type {
        ActionBlock,
        KeyOperation,
        KeyType,
        KeyMode,
    } from '$lib/types'
    import { MODE_LABELS } from '$lib/data/labels'
    import { planner } from '$lib/stores/planner.svelte'
    import CharacterTrack from './CharacterTrack.svelte'
    import ArrowOverlay from './ArrowOverlay.svelte'
    import KeyIcon from './KeyIcon.svelte'
    import ComboNumbers from './ComboNumbers.svelte'
    import StrongBadge from './StrongBadge.svelte'

    let {
        selectedKey,
        selectedMode,
        comboA = 0,
        comboB = 0,
        strong = false,
        comment = '',
    }: {
        selectedKey: KeyType
        selectedMode: KeyMode
        comboA?: number
        comboB?: number
        strong?: boolean
        comment?: string
    } = $props()

    let viewportWidth = $state(
        typeof window !== 'undefined' ? window.innerWidth : 1024,
    )

    $effect(() => {
        const handler = () => {
            viewportWidth = window.innerWidth
        }
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    })

    let blockRightEdge = $state(0)

    $effect(() => {
        const blocks = planner.blocks
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                let maxR = 0
                for (const b of blocks) {
                    const el = document.querySelector(
                        `[data-block-id="${b.id}"]`,
                    ) as HTMLElement
                    if (el) {
                        const w = el.getBoundingClientRect().width
                        maxR = Math.max(maxR, b.x + w)
                    }
                }
                blockRightEdge = maxR
            })
        })
    })

    let timelineMinWidth = $derived.by(() => {
        const blocks = planner.blocks
        if (blocks.length === 0) return viewportWidth
        const rightEdge =
            blockRightEdge || Math.max(...blocks.map((b) => b.x)) + 120
        return Math.max(viewportWidth, rightEdge + viewportWidth / 2)
    })

    let strongBadgeColor = $derived(
        planner.theme.key === 'light' ? '#000000' : '#ef4444',
    )

    let contextBlock = $state<ActionBlock | null>(null)
    let contextPos = $state({ x: 0, y: 0 })
    let scrollContainer = $state<HTMLDivElement | null>(null)
    let scrollbarTrack = $state<HTMLDivElement | null>(null)
    let scrollbarThumb = $state<HTMLDivElement | null>(null)

    let scrollLeft = $state(0)
    let scrollWidth = $state(0)
    let clientWidth = $state(0)
    let isDraggingThumb = $state(false)
    let dragStartX = $state(0)
    let dragStartScroll = $state(0)

    function handleWheel(e: WheelEvent) {
        if (!scrollContainer) return
        e.preventDefault()
        scrollContainer.scrollLeft += e.deltaY
    }

    function handleScroll() {
        if (!scrollContainer) return
        scrollLeft = scrollContainer.scrollLeft
        scrollWidth = scrollContainer.scrollWidth
        clientWidth = scrollContainer.clientWidth
    }

    function handleThumbPointerDown(e: PointerEvent) {
        e.preventDefault()
        isDraggingThumb = true
        dragStartX = e.clientX
        dragStartScroll = scrollLeft
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }

    function handleThumbPointerMove(e: PointerEvent) {
        if (!isDraggingThumb || !scrollContainer || !scrollbarTrack) return
        const trackWidth = scrollbarTrack.clientWidth
        const thumbWidth = scrollbarThumb?.clientWidth ?? 36
        const dx = e.clientX - dragStartX
        const maxScroll = scrollWidth - clientWidth
        if (maxScroll <= 0) return
        const ratio = dx / (trackWidth - thumbWidth)
        const newScroll = Math.max(
            0,
            Math.min(maxScroll, dragStartScroll + ratio * maxScroll),
        )
        scrollContainer.scrollLeft = newScroll
    }

    function handleThumbPointerUp() {
        isDraggingThumb = false
    }

    function handleTrackClick(e: MouseEvent) {
        if (!scrollContainer || !scrollbarTrack || !scrollbarThumb) return
        const rect = scrollbarTrack.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const thumbWidth = scrollbarThumb.clientWidth
        const trackWidth = scrollbarTrack.clientWidth
        const maxScroll = scrollWidth - clientWidth
        if (maxScroll <= 0) return
        const ratio = Math.max(
            0,
            Math.min(1, (clickX - thumbWidth / 2) / (trackWidth - thumbWidth)),
        )
        scrollContainer.scrollLeft = ratio * maxScroll
    }

    let thumbLeft = $derived.by(() => {
        const maxScroll = scrollWidth - clientWidth
        if (maxScroll <= 0) return 0
        const trackWidth = scrollbarTrack?.clientWidth ?? 100
        const thumbWidth = scrollbarThumb?.clientWidth ?? 36
        const ratio = scrollLeft / maxScroll
        return ratio * (trackWidth - thumbWidth)
    })

    let thumbWidthPx = $derived.by(() => {
        const maxScroll = scrollWidth - clientWidth
        if (maxScroll <= 0) return scrollbarTrack?.clientWidth ?? 100
        const ratio = clientWidth / scrollWidth
        const trackWidth = scrollbarTrack?.clientWidth ?? 100
        return Math.max(36, ratio * trackWidth)
    })

    $effect(() => {
        const el = scrollContainer
        if (!el) return
        el.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => el.removeEventListener('scroll', handleScroll)
    })

    function handleContext(block: ActionBlock, e: MouseEvent) {
        e.preventDefault()
        contextBlock = block
        contextPos = { x: e.clientX, y: e.clientY }
        planner.selectBlock(block.id)
    }

    function getPrevBlock(block: ActionBlock): ActionBlock | null {
        const charBlocks = planner
            .getCharacterBlocks(block.characterId)
            .toSorted((a, b) => a.x - b.x)
        const idx = charBlocks.findIndex((b) => b.id === block.id)
        if (idx <= 0) return null
        return charBlocks[idx - 1]
    }

    function stayFieldWithPrev(block: ActionBlock): boolean {
        const prev = getPrevBlock(block)
        if (!prev) return false
        return planner.stayFieldMarkers.some(
            (m) => m.fromBlockId === prev.id && m.toBlockId === block.id,
        )
    }

    function hasArrowTo(block: ActionBlock): boolean {
        const TOL = 2
        for (const char of planner.characters) {
            if (char.id === block.characterId) continue
            const prevBlocks = planner.getCharacterBlocks(char.id)
            for (const pb of prevBlocks) {
                const el = document.querySelector(
                    `[data-block-id="${pb.id}"]`,
                ) as HTMLElement
                if (!el) continue
                const w = el.getBoundingClientRect().width
                if (block.x >= pb.x - TOL && block.x <= pb.x + w + TOL)
                    return true
            }
        }
        return false
    }

    function toggleStayField(block: ActionBlock) {
        const prev = getPrevBlock(block)
        if (!prev) return
        const existing = planner.stayFieldMarkers.find(
            (m) => m.fromBlockId === prev.id && m.toBlockId === block.id,
        )
        if (existing) {
            planner.removeStayFieldMarker(existing.id)
        } else {
            planner.addStayFieldMarker(block.characterId, prev.id, block.id)
            if (block.isIntro) {
                planner.updateBlock(block.id, {
                    isIntro: false,
                    keyOps: block.keyOps.filter((op) => op.key !== 'intro'),
                })
            }
        }
    }

    function toggleIntro(block: ActionBlock) {
        if (!hasArrowTo(block)) return
        if (block.isIntro) {
            planner.updateBlock(block.id, {
                isIntro: false,
                keyOps: block.keyOps.filter((op) => op.key !== 'intro'),
            })
        } else {
            const prev = getPrevBlock(block)
            if (prev) {
                const existing = planner.stayFieldMarkers.find(
                    (m) =>
                        m.fromBlockId === prev.id && m.toBlockId === block.id,
                )
                if (existing) planner.removeStayFieldMarker(existing.id)
            }
            planner.updateBlock(block.id, {
                isIntro: true,
                keyOps: [{ key: 'intro', mode: 'click' }, ...block.keyOps],
            })
        }
    }

    function handleAvatarClick(charId: string) {
        const keyOp: KeyOperation = { key: selectedKey, mode: selectedMode }
        if (comboA > 0 && comboB > 0) {
            keyOp.comboStart = comboA
            keyOp.comboEnd = comboB
        }
        if (strong) keyOp.strong = true
        if (comment) keyOp.comment = comment
        const maxX = Math.max(
            ...planner.characters.map((c) => {
                const cBlocks = planner.getCharacterBlocks(c.id)
                if (cBlocks.length === 0) return 4
                return Math.max(...cBlocks.map((b) => b.x))
            }),
        )
        const x = Math.max(4, maxX + 40)
        const block = planner.addBlock(charId, x)
        planner.addKeyOp(block.id, keyOp)
    }

    $effect(() => {
        if (!contextBlock) return
        const handler = () => {
            contextBlock = null
        }
        document.addEventListener('click', handler, { once: true })
        return () => document.removeEventListener('click', handler)
    })
</script>

<div id="timeline-area" class="relative flex gap-3 min-h-0 flex-col">
    <div class="flex gap-3 min-h-0 flex-1">
        <div
            class="sticky left-0 z-10 flex flex-col gap-3 min-h-0"
            style="padding-top: 4px;"
        >
            {#each planner.characters as char, i (char.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="relative h-10 w-10 overflow-hidden rounded-full"
                    style="border: 2px solid {planner.getTrackColor(char.id, i)
                        .border}; margin-top: 8px; margin-left: 8px; flex-shrink: 0;"
                    title={char.name}
                    onclick={() => handleAvatarClick(char.id)}
                >
                    {#if char.presetId}
                        <img
                            src={`/images/avatars/${char.presetId}.png`}
                            alt={char.name}
                            class="absolute inset-0 z-10 h-full w-full object-cover"
                            onerror={(e) =>
                                ((e.target as HTMLElement).style.display =
                                    'none')}
                        />
                    {/if}
                    <div
                        class="flex h-full w-full items-center justify-center text-sm font-bold text-white"
                    >
                        {char.name.charAt(0)}
                    </div>
                </div>
            {/each}
        </div>

        <div
            bind:this={scrollContainer}
            class="min-w-0 flex-1 overflow-x-auto min-h-0 scrollbar-none"
            onwheel={handleWheel}
        >
            <div
                style="position: relative; min-height: 0; min-width: {timelineMinWidth}px;"
            >
                <div class="flex flex-col gap-3 min-h-0">
                    {#each planner.characters as char, i (char.id)}
                        <CharacterTrack
                            character={char}
                            index={i}
                            {selectedKey}
                            {selectedMode}
                            {comboA}
                            {comboB}
                            {strong}
                            {comment}
                            oneditBlock={() => {}}
                            oncontextBlock={handleContext}
                            oncloseContext={() => {
                                contextBlock = null
                            }}
                        />
                    {/each}
                </div>

                <ArrowOverlay />
            </div>
        </div>

        {#if contextBlock}
            <div
                class="fixed z-50 min-w-52 rounded-lg py-1.5 shadow-xl"
                style="left: {contextPos.x}px; top: {contextPos.y}px; border: 1px solid {planner
                    .theme.contextBorder}; background: {planner.theme
                    .contextBg};"
            >
                {#if contextBlock.keyOps.length > 0}
                    <div
                        style="border-bottom: 1px solid {planner.theme
                            .divider};"
                    >
                        <div class="px-2 pt-1.5 pb-1">
                            <div
                                class="mb-1 px-1 text-xs font-semibold"
                                style="color: {planner.theme.textSecondary};"
                            >
                                操作列表
                            </div>
                        </div>
                        <div
                            class="max-h-56 overflow-y-auto scrollbar-dark-thick px-2 pb-1.5"
                        >
                            {#each contextBlock.keyOps as op, i}
                                {#if op.key !== 'intro'}
                                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                                    <div
                                        draggable="true"
                                        class="flex w-full cursor-default items-center gap-1.5 rounded px-1.5 py-1"
                                        style="color: {planner.theme
                                            .textSecondary};"
                                        onmouseenter={(e) =>
                                            ((
                                                e.currentTarget as HTMLElement
                                            ).style.background =
                                                planner.theme.contextHover)}
                                        onmouseleave={(e) =>
                                            ((
                                                e.currentTarget as HTMLElement
                                            ).style.background = '')}
                                        ondragstart={(e) => {
                                            const data = JSON.stringify({
                                                fromBlockId: contextBlock!.id,
                                                keyOpIndex: i,
                                                keyOp: op,
                                            })
                                            e.dataTransfer!.setData(
                                                'application/wuwa-keyop-context',
                                                data,
                                            )
                                            e.dataTransfer!.effectAllowed =
                                                'move'
                                            ;(
                                                e.currentTarget as HTMLElement
                                            ).style.opacity = '0.4'
                                        }}
                                        ondragend={(e) => {
                                            ;(
                                                e.currentTarget as HTMLElement
                                            ).style.opacity = '1'
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
                                            const fromBlockId =
                                                parsed.fromBlockId
                                            const keyOpIndex = parsed.keyOpIndex
                                            if (
                                                fromBlockId !==
                                                    contextBlock!.id ||
                                                keyOpIndex === i
                                            )
                                                return
                                            const ops = [
                                                ...contextBlock!.keyOps,
                                            ]
                                            const [moved] = ops.splice(
                                                keyOpIndex,
                                                1,
                                            )
                                            ops.splice(i, 0, moved)
                                            planner.updateBlock(
                                                contextBlock!.id,
                                                {
                                                    keyOps: ops,
                                                },
                                            )
                                            const updated = planner.blocks.find(
                                                (b) =>
                                                    b.id === contextBlock!.id,
                                            )
                                            if (updated) contextBlock = updated
                                        }}
                                    >
                                        <span
                                            class="cursor-grab active:cursor-grabbing"
                                            style="color: {planner.theme
                                                .mutedText};">⠿</span
                                        >
                                        <span class="inline-flex items-center relative">
                                            {#if op.strong}
                                                <div class="absolute -left-1.5 -top-3 z-10">
                                                    <StrongBadge size={10} color={strongBadgeColor} />
                                                </div>
                                            {/if}
                                            <KeyIcon
                                                key={op.key}
                                                size="sm"
                                                color={planner.theme.nodeColors[
                                                    op.key
                                                ]}
                                                mode={op.mode}
                                            />
                                        </span>
                                        {#if op.comboStart && op.comboEnd && op.comboStart > 0 && op.comboEnd > 0}
                                            <ComboNumbers start={op.comboStart} end={op.comboEnd} theme={planner.theme} />
                                        {/if}
                                        {#if op.comment}
                                            <span class="text-[10px] ml-0.5 rounded px-1" style="background: {planner.theme.key === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}; color: {planner.theme.key === 'light' ? '#000000' : '#ffffff'};">{op.comment}</span>
                                        {/if}
                                        <span
                                            class="flex-1 text-xs"
                                            style="color: {planner.theme
                                                .textSecondary};"
                                        >
                                            {MODE_LABELS[op.mode] || '单击'}
                                        </span>
                                        <button
                                            class="flex h-5 w-5 items-center justify-center rounded text-[10px]"
                                            style="border: 1px solid {planner
                                                .theme
                                                .deleteBtnBorder}; color: {planner
                                                .theme.textSecondary};"
                                            onmouseenter={(e) =>
                                                ((
                                                    e.currentTarget as HTMLElement
                                                ).style.background =
                                                    planner.theme.deleteBtnHover)}
                                            onmouseleave={(e) =>
                                                ((
                                                    e.currentTarget as HTMLElement
                                                ).style.background = '')}
                                            onclick={(e) => {
                                                e.stopPropagation()
                                                planner.removeKeyOp(
                                                    contextBlock!.id,
                                                    i,
                                                )
                                                contextBlock = null
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
                                        style="border-color: {planner.theme
                                            .border}; color: {planner.theme
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
                                            const introIdx =
                                                contextBlock!.keyOps.findIndex(
                                                    (o) => o.key === 'intro',
                                                )
                                            if (introIdx < 0) return
                                            const ops = [
                                                ...contextBlock!.keyOps,
                                            ]
                                            ops[introIdx] = {
                                                ...ops[introIdx],
                                                strong: !ops[introIdx].strong,
                                            }
                                            planner.updateBlock(
                                                contextBlock!.id,
                                                {
                                                    keyOps: ops,
                                                },
                                            )
                                            const updated =
                                                planner.blocks.find(
                                                    (b) =>
                                                        b.id ===
                                                        contextBlock!.id,
                                                )
                                            if (updated)
                                                contextBlock = updated
                                        }}
                                    >
                                        {contextBlock.keyOps.find((o) => o.key === 'intro')
                                            ?.strong
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
                    style="color: {!getPrevBlock(contextBlock) ?
                        planner.theme.mutedText
                    :   planner.theme.accentText}; cursor: {(
                        !getPrevBlock(contextBlock)
                    ) ?
                        'not-allowed'
                    :   'pointer'};"
                    disabled={!getPrevBlock(contextBlock)}
                    onmouseenter={(e) => {
                        if (getPrevBlock(contextBlock!))
                            (e.currentTarget as HTMLElement).style.background =
                                planner.theme.accentHover
                    }}
                    onmouseleave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = ''
                    }}
                    onclick={() => {
                        toggleStayField(contextBlock!)
                        contextBlock = null
                    }}
                >
                    {stayFieldWithPrev(contextBlock) ?
                        '清除与上一个块之间的留场'
                    :   '与上一个块建立留场'}
                </button>

                <button
                    class="flex w-full items-center px-4 py-2 text-left text-xs"
                    style="color: {!hasArrowTo(contextBlock) ?
                        planner.theme.mutedText
                    : contextBlock.isIntro ? '#f59e0b'
                    : planner.theme.accentText}; cursor: {(
                        !hasArrowTo(contextBlock)
                    ) ?
                        'not-allowed'
                    :   'pointer'};"
                    disabled={!hasArrowTo(contextBlock)}
                    onmouseenter={(e) => {
                        if (hasArrowTo(contextBlock!))
                            (e.currentTarget as HTMLElement).style.background =
                                planner.theme.accentHover
                    }}
                    onmouseleave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = ''
                    }}
                    onclick={() => {
                        toggleIntro(contextBlock!)
                        contextBlock = null
                    }}
                >
                    {contextBlock.isIntro ? '取消变奏入场' : '设为变奏入场'}
                </button>

                <div
                    style="border-top: 1px solid {planner.theme.divider};"
                ></div>

                <button
                    class="flex w-full items-center px-4 py-2 text-left text-xs"
                    style="color: {planner.theme.dangerText};"
                    onmouseenter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                            planner.theme.dangerHover)}
                    onmouseleave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                            '')}
                    onclick={() => {
                        planner.removeBlock(contextBlock!.id)
                        contextBlock = null
                    }}>删除操作块</button
                >
            </div>
        {/if}
    </div>

    <!-- Custom horizontal scrollbar -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="h-3 shrink-0 mx-3">
        <div
            bind:this={scrollbarTrack}
            class="relative h-full rounded-full cursor-pointer"
            style="background: {planner.theme.scrollbarTrack};"
            onclick={handleTrackClick}
        >
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                bind:this={scrollbarThumb}
                class="absolute top-0 h-full rounded-full cursor-grab active:cursor-grabbing"
                style="left: {thumbLeft}px; width: {thumbWidthPx}px; background: {planner
                    .theme.scrollbarThumb};"
                onmouseenter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                        planner.theme.scrollbarThumbHover)}
                onmouseleave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                        planner.theme.scrollbarThumb)}
                onpointerdown={handleThumbPointerDown}
                onpointermove={handleThumbPointerMove}
                onpointerup={handleThumbPointerUp}
            ></div>
        </div>
    </div>
</div>
