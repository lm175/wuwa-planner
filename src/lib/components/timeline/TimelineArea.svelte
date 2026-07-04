<script lang="ts">
    import type { ActionBlock, KeyOperation, KeyType, KeyMode } from '$lib/types'
    import { planner } from '$lib/stores/planner.svelte'
    import CharacterTrack from './CharacterTrack.svelte'
    import ArrowOverlay from './ArrowOverlay.svelte'
    import TimelineContextMenu from './TimelineContextMenu.svelte'
    import Avatar from '../character/Avatar.svelte'
    import { getPrevBlock, canBeIntro } from '$lib/utils/timeline'
    import { notification } from '$lib/stores/notification.svelte'

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

    let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024)

    let isMobile = $derived(viewportWidth < 768)

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
                    const el = document.querySelector(`[data-block-id="${b.id}"]`) as HTMLElement
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
        const rightEdge = blockRightEdge || Math.max(...blocks.map((b) => b.x)) + 120
        return Math.max(viewportWidth, rightEdge + viewportWidth / 2)
    })

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
        const newScroll = Math.max(0, Math.min(maxScroll, dragStartScroll + ratio * maxScroll))
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

    let hasPrevContext = $derived(
        contextBlock ? !!getPrevBlock(contextBlock, planner.blocks) : false,
    )
    let stayFieldActive = $derived.by(() => {
        if (!contextBlock) return false
        const prev = getPrevBlock(contextBlock, planner.blocks)
        if (!prev) return false
        return planner.stayFieldMarkers.some(
            (m) => m.fromBlockId === prev.id && m.toBlockId === contextBlock!.id,
        )
    })
    let canToggleIntro = $derived(contextBlock ? canBeIntro(contextBlock, planner.blocks) : false)

    function handleReorderKeyOps(
        blockId: string,
        keyOps: KeyOperation[],
        _updatedBlock: ActionBlock | null,
    ) {
        planner.updateBlock(blockId, { keyOps })
        const updated = planner.blocks.find((b) => b.id === blockId)
        if (updated) contextBlock = updated
    }

    function handleToggleIntroStrong(blockId: string) {
        const block = planner.blocks.find((b) => b.id === blockId)
        if (!block) return
        const introIdx = block.keyOps.findIndex((o) => o.key === 'intro')
        if (introIdx < 0) return
        const ops = [...block.keyOps]
        ops[introIdx] = {
            ...ops[introIdx],
            strong: !ops[introIdx].strong,
        }
        planner.updateBlock(blockId, { keyOps: ops })
        const updated = planner.blocks.find((b) => b.id === blockId)
        if (updated) contextBlock = updated
    }

    function toggleStayField(block: ActionBlock) {
        const prev = getPrevBlock(block, planner.blocks)
        if (!prev) return
        const existing = planner.stayFieldMarkers.find(
            (m) => m.fromBlockId === prev.id && m.toBlockId === block.id,
        )
        if (existing) {
            if (block.isOffHand) {
                planner.updateBlock(block.id, { isOffHand: false })
                notification.show('已清除留场，自动取消脱手')
            }
            planner.removeStayFieldMarker(existing.id)
        } else {
            if (block.isIntro) {
                planner.updateBlock(block.id, {
                    isIntro: false,
                    keyOps: block.keyOps.filter((op) => op.key !== 'intro'),
                })
                notification.show('已建立留场，自动取消变奏入场')
            }
            planner.addStayFieldMarker(block.characterId, prev.id, block.id)
        }
    }

    function toggleIntro(block: ActionBlock) {
        if (!canBeIntro(block, planner.blocks)) return
        if (block.isIntro) {
            planner.updateBlock(block.id, {
                isIntro: false,
                keyOps: block.keyOps.filter((op) => op.key !== 'intro'),
            })
        } else {
            const prev = getPrevBlock(block, planner.blocks)
            const existing = prev
                ? planner.stayFieldMarkers.find(
                      (m) => m.fromBlockId === prev.id && m.toBlockId === block.id,
                  )
                : null
            if (existing) {
                planner.removeStayFieldMarker(existing.id)
            }
            if (block.isOffHand) {
                planner.updateBlock(block.id, { isOffHand: false })
            }
            if (existing && block.isOffHand) {
                notification.show('已设为变奏入场，自动取消留场和脱手')
            } else if (existing) {
                notification.show('已设为变奏入场，自动取消留场')
            } else if (block.isOffHand) {
                notification.show('已设为变奏入场，自动取消脱手')
            }
            planner.updateBlock(block.id, {
                isIntro: true,
                isOffHand: false,
                keyOps: [{ key: 'intro', mode: 'click' }, ...block.keyOps],
            })
        }
    }

    function handleToggleOffHand(block: ActionBlock) {
        planner.updateBlock(block.id, { isOffHand: !block.isOffHand })
        const updated = planner.blocks.find((b) => b.id === block.id)
        if (updated) contextBlock = updated
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
    {@render customScrollbar()}
    <div class="flex min-h-0 flex-1">
        <div
            bind:this={scrollContainer}
            class="min-w-0 flex-1 min-h-0 scrollbar-none {isMobile
                ? 'overflow-x-hidden touch-pan-y'
                : 'overflow-x-auto'}"
            onwheel={handleWheel}
        >
            <div style="position: relative; min-height: 0; min-width: {timelineMinWidth}px;">
                <div
                    class="grid min-h-0"
                    style="grid-template-columns: auto 1fr; column-gap: 12px; row-gap: 12px;"
                >
                    {#each planner.characters as char, i (char.id)}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <div
                            class="sticky left-0 z-10 flex items-center justify-center pl-1"
                            style="min-height: 52px;"
                            onclick={() => handleAvatarClick(char.id)}
                        >
                            <div
                                class="relative h-8 w-8 shrink-0 overflow-hidden rounded-full"
                                style="border: 2px solid {planner.getTrackColor(char.id, i)
                                    .border};"
                                title={char.name}
                            >
                                <Avatar presetId={char.presetId} name={char.name} size="md" />
                            </div>
                        </div>
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

        <TimelineContextMenu
            {contextBlock}
            {contextPos}
            hasPrev={hasPrevContext}
            {stayFieldActive}
            {canToggleIntro}
            onToggleStayField={(block) => {
                toggleStayField(block)
                contextBlock = null
            }}
            onToggleIntro={(block) => {
                toggleIntro(block)
                contextBlock = null
            }}
            onToggleOffHand={handleToggleOffHand}
            onDeleteBlock={(id) => {
                planner.removeBlock(id)
                contextBlock = null
            }}
            onReorderKeyOps={handleReorderKeyOps}
            onToggleIntroStrong={handleToggleIntroStrong}
            onClose={() => {
                contextBlock = null
            }}
        />
    </div>

    {#snippet customScrollbar()}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="h-1.5 shrink-0 mx-3 hidden sm:block">
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
                    style="left: {thumbLeft}px; width: {thumbWidthPx}px; background: {planner.theme
                        .scrollbarThumb};"
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
    {/snippet}

    {#snippet scrollBtn(dir: number, label: string)}
        <button
            class="flex flex-1 h-9 items-center justify-center rounded text-lg font-bold transition-colors"
            style="border: 1px solid {planner.theme.border}; color: {planner.theme
                .textSecondary}; background: {planner.theme.panelBg};"
            onmouseenter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = planner.theme.buttonHover
                ;(e.currentTarget as HTMLElement).style.color = planner.theme.text
            }}
            onmouseleave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = planner.theme.panelBg
                ;(e.currentTarget as HTMLElement).style.color = planner.theme.textSecondary
            }}
            onpointerdown={(e) => e.preventDefault()}
            onclick={() => scrollContainer?.scrollBy({ left: dir, behavior: 'smooth' })}
            >{label}</button
        >
    {/snippet}

    {#if isMobile}
        <div class="flex items-center justify-center gap-2 shrink-0 pb-2 px-2">
            {@render scrollBtn(-Math.round(clientWidth * 0.2), '‹')}
            {@render scrollBtn(Math.round(clientWidth * 0.2), '›')}
        </div>
    {/if}
</div>
