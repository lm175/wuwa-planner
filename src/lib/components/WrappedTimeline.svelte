<script lang="ts">
    import { onMount } from 'svelte'
    import { planner } from '$lib/stores/planner.svelte'
    import ActionBlockComp from './ActionBlock.svelte'
    import type { ActionBlock } from '$lib/types'
    import { toPng } from 'html-to-image'

    let container = $state<HTMLDivElement | null>(null)
    let canvas = $state<HTMLCanvasElement | null>(null)
    let ctx = $state<CanvasRenderingContext2D | null>(null)
    let timelineRef = $state<HTMLDivElement | null>(null)
    let containerWidth = $state(600)
    let contextMenu = $state<{ x: number; y: number } | null>(null)

    const AVATAR_COL = 72
    const ROW_H = 24
    const ROW_GAP = 14
    const CORNER = 4
    const GO_RIGHT = 16

    $effect(() => {
        if (!container) return
        const obs = new ResizeObserver((e) => {
            containerWidth = e[0].contentRect.width
        })
        obs.observe(container)
        return () => obs.disconnect()
    })

    interface Segment {
        startX: number
        blocks: ActionBlock[]
    }

    let segments = $derived.by((): Segment[] => {
        const all = planner.blocks.toSorted((a, b) => a.x - b.x)
        if (all.length === 0) return []
        const segW = Math.max(containerWidth - AVATAR_COL - 32, 200)
        const segs: Segment[] = []
        let cur: ActionBlock[] = [],
            curX = all[0].x
        for (const b of all) {
            // rough width estimate for overflow detection
            const comboOps = b.keyOps.filter(
                (o) =>
                    o.comboStart &&
                    o.comboEnd &&
                    o.comboStart > 0 &&
                    o.comboEnd > 0,
            ).length
            const estW =
                b.keyOps.length * 49 +
                b.customIcons.length * 80 +
                comboOps * 36 +
                24
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
    })

    $effect(() => {
        if (!canvas) return
        ctx = canvas.getContext('2d')
    })

    $effect(() => {
        void segments.length
        void planner.blocks.map((b) => b.id + b.x).join(',')
        void planner.stayFieldMarkers.map((m) => m.id).join(',')
        void planner.theme
        void containerWidth
        requestAnimationFrame(() =>
            requestAnimationFrame(() =>
                requestAnimationFrame(() => drawArrows()),
            ),
        )
    })

    function drawArrows() {
        const c = canvas,
            cx = ctx
        if (!c || !cx || !timelineRef || containerWidth < 10) return

        const dpr = window.devicePixelRatio || 1
        const tlRect = timelineRef.getBoundingClientRect()
        const W = tlRect.width,
            H = tlRect.height
        c.width = W * dpr
        c.height = H * dpr
        c.style.width = W + 'px'
        c.style.height = H + 'px'
        cx.setTransform(dpr, 0, 0, dpr, 0, 0)
        cx.clearRect(0, 0, W, H)

        const chars = planner.characters
        const segEls = document.querySelectorAll('[data-wseg]')

        const toCanvasX = (sx: number) => sx - tlRect.left
        const toCanvasY = (sy: number) => sy - tlRect.top

        // ── Within-segment swap arrows ──
        segEls.forEach((segEl, si) => {
            const seg = segments[si]
            if (!seg || seg.blocks.length === 0) return

            for (let srcIdx = 0; srcIdx < chars.length; srcIdx++) {
                for (let dstIdx = 0; dstIdx < chars.length; dstIdx++) {
                    if (srcIdx === dstIdx) continue
                    const sbl = seg.blocks
                        .filter((b) => b.characterId === chars[srcIdx].id)
                        .toSorted((a, b) => a.x - b.x)
                    const dbl = seg.blocks
                        .filter((b) => b.characterId === chars[dstIdx].id)
                        .toSorted((a, b) => a.x - b.x)
                    if (!sbl.length || !dbl.length) continue

                    const used = new Set<string>()
                    for (const db of dbl) {
                        for (const sb of sbl) {
                            if (used.has(sb.id)) continue
                            const sEl = segEl.querySelector(
                                `[data-block-id="${sb.id}"]`,
                            ) as HTMLElement
                            if (!sEl) continue
                            const dEl = segEl.querySelector(
                                `[data-block-id="${db.id}"]`,
                            ) as HTMLElement
                            if (!dEl) continue
                            const sR = sEl.getBoundingClientRect()
                            const srcEnd = sb.x + sR.width
                            if (db.x < sb.x - 2 || db.x > srcEnd + 2) continue

                            const sRow = segEl.querySelector(
                                `[data-track-row="${srcIdx}"]`,
                            ) as HTMLElement
                            const dRow = segEl.querySelector(
                                `[data-track-row="${dstIdx}"]`,
                            ) as HTMLElement
                            if (!sRow || !dRow) continue
                            const srR = sRow.getBoundingClientRect()
                            const drR = dRow.getBoundingClientRect()

                            const ax = toCanvasX(
                                dEl.getBoundingClientRect().left,
                            )
                            const ay1 = toCanvasY(
                                srcIdx > dstIdx ? srR.top : srR.bottom,
                            )
                            const ay2 = toCanvasY(
                                srcIdx > dstIdx ? drR.bottom : drR.top,
                            )
                            if (ax <= 0 || ay1 <= 0 || ay2 <= 0) continue

                            drawArrow(
                                cx,
                                ax,
                                ay1,
                                ax,
                                ay2,
                                planner.getTrackColor(chars[srcIdx].id, srcIdx)
                                    .border,
                            )
                            used.add(sb.id)
                            break
                        }
                    }
                }
            }

            // ── Same-segment stay-fields ──
            for (const m of planner.stayFieldMarkers) {
                const fEl = segEl.querySelector(
                    `[data-block-id="${m.fromBlockId}"]`,
                ) as HTMLElement
                const tEl = segEl.querySelector(
                    `[data-block-id="${m.toBlockId}"]`,
                ) as HTMLElement
                if (!fEl || !tEl) continue
                const fR = fEl.getBoundingClientRect(),
                    tR = tEl.getBoundingClientRect()
                drawStayRect(
                    cx,
                    toCanvasX(fR.left),
                    toCanvasY(fR.top),
                    toCanvasX(tR.right),
                    fR.height,
                    planner.theme.stayField,
                )
            }
        })

        // ── Cross-segment stay-field markers ──
        for (const m of planner.stayFieldMarkers) {
            let fromSi = -1,
                toSi = -1
            for (let si = 0; si < segments.length; si++) {
                if (segments[si].blocks.some((b) => b.id === m.fromBlockId))
                    fromSi = si
                if (segments[si].blocks.some((b) => b.id === m.toBlockId))
                    toSi = si
            }
            if (fromSi < 0 || toSi < 0 || fromSi === toSi) continue

            const fSegEl = segEls[fromSi] as HTMLElement
            const tSegEl = segEls[toSi] as HTMLElement
            const fEl = fSegEl.querySelector(
                `[data-block-id="${m.fromBlockId}"]`,
            ) as HTMLElement
            const tEl = tSegEl.querySelector(
                `[data-block-id="${m.toBlockId}"]`,
            ) as HTMLElement
            if (!fEl || !tEl) continue

            const fR = fEl.getBoundingClientRect()
            const tR = tEl.getBoundingClientRect()
            const fArea = fSegEl.querySelector('[data-track-area]')
            const tArea = tSegEl.querySelector('[data-track-area]')
            if (!fArea || !tArea) continue

            drawStayRect(
                cx,
                toCanvasX(fR.left),
                toCanvasY(fR.top),
                toCanvasX(fArea.getBoundingClientRect().right),
                fR.height,
                planner.theme.stayField,
            )
            drawStayRect(
                cx,
                toCanvasX(tArea.getBoundingClientRect().left),
                toCanvasY(tR.top),
                toCanvasX(tR.right),
                tR.height,
                planner.theme.stayField,
            )
        }

        // ── Long-block wrap indicators ──
        for (let si = 0; si < segments.length; si++) {
            const segEl = segEls[si] as HTMLElement
            if (!segEl) continue
            const area = segEl.querySelector('[data-track-area]') as HTMLElement
            if (!area) continue
            const areaR = area.getBoundingClientRect()
            const seg = segments[si]
            if (!seg) continue

            for (const b of seg.blocks) {
                const bEl = segEl.querySelector(
                    `[data-block-id="${b.id}"]`,
                ) as HTMLElement
                if (!bEl) continue
                const bR = bEl.getBoundingClientRect()
                if (bR.right <= areaR.right + 2) continue // no overflow

                // Upper half: left-closed (block left), right-open (area right)
                drawStayRect(
                    cx,
                    toCanvasX(bR.left),
                    toCanvasY(bR.top),
                    toCanvasX(areaR.right),
                    bR.height,
                    planner.theme.wrapIndicator,
                )
            }
        }

        // ── Cross-segment curve arrows ──
        if (segments.length >= 2 && segEls.length >= 2) {
            for (let s = 0; s < segments.length - 1; s++) {
                const seg = segments[s],
                    nseg = segments[s + 1]
                if (!seg.blocks.length || !nseg.blocks.length) continue
                const lb = seg.blocks[seg.blocks.length - 1]
                const fb = nseg.blocks[0]
                const tci = chars.findIndex((c) => c.id === fb.characterId)
                if (tci < 0) continue
                const lci = chars.findIndex((c) => c.id === lb.characterId)

                const sEl = segEls[s] as HTMLElement
                const nEl = segEls[s + 1] as HTMLElement
                const lE = sEl.querySelector(
                    `[data-block-id="${lb.id}"]`,
                ) as HTMLElement
                const aE = nEl.querySelector(
                    `[data-avatar-idx="${tci}"]`,
                ) as HTMLElement
                if (!lE || !aE) continue

                const lR = lE.getBoundingClientRect(),
                    aR = aE.getBoundingClientRect()
                const sR = sEl.getBoundingClientRect(),
                    nR = nEl.getBoundingClientRect()

                const x1 = toCanvasX(lR.right) + 2
                const y1 = toCanvasY(lR.top + lR.height / 2)
                const x2 = toCanvasX(aR.left)
                const y2 = toCanvasY(aR.top + aR.height / 2)
                if (x2 <= 0 || y2 <= 0) continue

                const yGap = (toCanvasY(sR.bottom) + toCanvasY(nR.top)) / 2
                const xR = x1 + GO_RIGHT
                const xT = x2 - CORNER * 3
                const ac = planner.getTrackColor(chars[tci].id, tci).border

                cx.beginPath()
                cx.moveTo(x1, y1)
                cx.lineTo(xR, y1)
                cx.arcTo(xR + CORNER, y1, xR + CORNER, y1 + CORNER, CORNER)
                cx.lineTo(xR + CORNER, yGap)
                cx.arcTo(xR + CORNER, yGap + CORNER, xR, yGap + CORNER, CORNER)
                cx.lineTo(xT, yGap + CORNER)
                cx.arcTo(
                    xT - CORNER,
                    yGap + CORNER,
                    xT - CORNER,
                    yGap + CORNER * 2,
                    CORNER,
                )
                cx.lineTo(xT - CORNER, y2 - CORNER)
                cx.arcTo(xT, y2, x2, y2, CORNER)
                cx.strokeStyle = ac
                cx.lineWidth = 2
                cx.globalAlpha = 0.5
                cx.lineCap = 'round'
                cx.lineJoin = 'round'
                cx.stroke()
                cx.globalAlpha = 1

                cx.fillStyle = ac
                cx.globalAlpha = 0.5
                cx.beginPath()
                cx.moveTo(x2, y2)
                cx.lineTo(
                    x2 - 7 * Math.cos(Math.PI / 6),
                    y2 - 7 * Math.sin(Math.PI / 6),
                )
                cx.lineTo(
                    x2 - 7 * Math.cos(-Math.PI / 6),
                    y2 - 7 * Math.sin(-Math.PI / 6),
                )
                cx.closePath()
                cx.fill()
                cx.globalAlpha = 1
            }
        }
    }

    function roundRect(
        cx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
    ) {
        cx.beginPath()
        cx.moveTo(x + r, y)
        cx.lineTo(x + w - r, y)
        cx.arcTo(x + w, y, x + w, y + r, r)
        cx.lineTo(x + w, y + h - r)
        cx.arcTo(x + w, y + h, x + w - r, y + h, r)
        cx.lineTo(x + r, y + h)
        cx.arcTo(x, y + h, x, y + h - r, r)
        cx.lineTo(x, y + r)
        cx.arcTo(x, y, x + r, y, r)
        cx.closePath()
    }

    function drawStayRect(
        cx: CanvasRenderingContext2D,
        x: number,
        y: number,
        right: number,
        h: number,
        color: string,
    ) {
        const w = right - x
        if (w <= 0 || h <= 0) return
        cx.strokeStyle = color
        cx.lineWidth = 1.5
        cx.setLineDash([4, 3])
        roundRect(cx, x, y, w, h, 4)
        cx.stroke()
        cx.setLineDash([])
    }

    function drawArrow(
        cx: CanvasRenderingContext2D,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: string,
    ) {
        cx.strokeStyle = color
        cx.lineWidth = 2
        cx.globalAlpha = 0.7
        cx.lineCap = 'round'
        cx.beginPath()
        cx.moveTo(x1, y1)
        cx.lineTo(x2, y2)
        cx.stroke()
        cx.globalAlpha = 1
        const a = Math.atan2(y2 - y1, x2 - x1)
        cx.fillStyle = color
        cx.globalAlpha = 0.7
        cx.beginPath()
        cx.moveTo(x2, y2)
        cx.lineTo(
            x2 - 7 * Math.cos(a - Math.PI / 6),
            y2 - 7 * Math.sin(a - Math.PI / 6),
        )
        cx.lineTo(
            x2 - 7 * Math.cos(a + Math.PI / 6),
            y2 - 7 * Math.sin(a + Math.PI / 6),
        )
        cx.closePath()
        cx.fill()
        cx.globalAlpha = 1
    }

    function handleContextMenu(e: MouseEvent) {
        e.preventDefault()
        contextMenu = { x: e.clientX, y: e.clientY }
    }
    function handleDocClick() {
        contextMenu = null
    }
    async function handleDownload() {
        contextMenu = null
        if (!container) return
        try {
            const dataUrl = await toPng(container, {
                backgroundColor: planner.theme.exportBg,
                pixelRatio: 2,
            })
            const a = document.createElement('a')
            a.download = `${planner.title || 'rotation'}.png`
            a.href = dataUrl
            a.click()
        } catch (e) {
            /* ignore */
        }
    }
    onMount(() => {
        document.addEventListener('click', handleDocClick)
        return () => document.removeEventListener('click', handleDocClick)
    })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    bind:this={container}
    class="relative w-full px-5"
    oncontextmenu={handleContextMenu}
>
    <div
        bind:this={timelineRef}
        style="position: relative; background: {planner.theme.exportBg};"
    >
        {#if segments.length === 0}
            <div
                class="flex h-20 items-center justify-center text-sm"
                style="color: {planner.theme.mutedText};"
            >
                暂无操作块
            </div>
        {:else}
            {#each segments as seg, si}
                <div data-wseg={si} class="mb-3" style="position: relative;">
                    <div class="flex items-center gap-1 mb-1.5">
                        <!-- 隐藏 段n 行 -->
                        <div
                            class="h-px flex-1"
                            style="background: {planner.theme
                                .divider}; opacity: 0.5;"
                            hidden
                        ></div>
                        <span
                            class="text-[10px] font-medium"
                            style="color: {planner.theme.segmentLabel};"
                            hidden>段 {si + 1}</span
                        >
                        <div
                            class="h-px flex-1"
                            style="background: {planner.theme
                                .divider}; opacity: 0.5;"
                            hidden
                        ></div>
                    </div>
                    <div class="flex gap-0.5 pr-8">
                        <div
                            class="flex flex-col shrink-0"
                            style="width: {AVATAR_COL}px; gap: {ROW_GAP}px;"
                        >
                            {#each planner.characters as char, ci}
                                {@const tc = planner.getTrackColor(char.id, ci)}
                                <div
                                    data-avatar-idx={ci}
                                    class="relative mx-auto h-8 w-8 shrink-0 overflow-hidden rounded-full"
                                    style="border: 1.5px solid {tc.border}; margin-top: {(ROW_H -
                                        32) /
                                        2}px;"
                                    title={char.name}
                                >
                                    {#if char.presetId}
                                        <img
                                            src={`/images/avatars/${char.presetId}.png`}
                                            alt={char.name}
                                            class="absolute inset-0 h-full w-full object-cover"
                                            onerror={(e) =>
                                                ((
                                                    e.target as HTMLElement
                                                ).style.display = 'none')}
                                        />
                                    {/if}
                                    <div
                                        class="flex h-full w-full items-center justify-center text-[10px] font-bold text-white"
                                    >
                                        {char.name.charAt(0)}
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <div
                            data-track-area
                            class="min-w-0 flex-1"
                            style="display: flex; flex-direction: column; gap: {ROW_GAP}px;"
                        >
                            {#each planner.characters as char, ci}
                                {@const tc = planner.getTrackColor(char.id, ci)}
                                {@const cbl = seg.blocks
                                    .filter((b) => b.characterId === char.id)
                                    .toSorted((a, b) => a.x - b.x)}
                                <div
                                    data-track-row={ci}
                                    class="relative rounded px-1 py-0"
                                    style="border-left: 3px solid {tc.gradient}; min-height: {ROW_H}px;"
                                >
                                    {#if cbl.length === 0}
                                        <div
                                            class="flex items-center text-[10px]"
                                            style="height: {ROW_H}px; color: {planner
                                                .theme.mutedText};"
                                        >
                                            &nbsp;
                                        </div>
                                    {:else}
                                        {#each cbl as b (b.id)}
                                            <div
                                                class="absolute"
                                                style="left: {Math.max(
                                                    0,
                                                    b.x - seg.startX,
                                                )}px; top: 0;"
                                            >
                                                <ActionBlockComp
                                                    block={b}
                                                    theme={planner.theme}
                                                    compact={true}
                                                />
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
        <canvas
            bind:this={canvas}
            class="pointer-events-none absolute inset-0 select-none"
            style="z-index: 5;"
        ></canvas>
    </div>
</div>

{#if contextMenu}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed z-50 w-36 rounded-lg py-1 shadow-xl"
        style="left: {contextMenu.x}px; top: {contextMenu.y}px; border: 1px solid {planner
            .theme.contextBorder}; background: {planner.theme.contextBg};"
    >
        <button
            class="flex w-full items-center px-4 py-2 text-left text-xs transition-colors"
            style="color: {planner.theme.text};"
            onmouseenter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background =
                    planner.theme.contextHover
            }}
            onmouseleave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = ''
            }}
            onclick={handleDownload}>下载为图片</button
        >
    </div>
{/if}
