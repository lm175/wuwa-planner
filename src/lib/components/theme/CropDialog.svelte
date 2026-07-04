<script lang="ts">
    import { planner } from '$lib/stores/planner.svelte'
    import { dialog } from '$lib/stores/dialog.svelte'
    import { onMount } from 'svelte'
    import {
        getHandleAt,
        cursorStyle as cursorStyleUtil,
        clampCropResize,
        rotateImageDataUrl,
    } from '$lib/utils/crop'

    let {
        imageUrl,
        outputSize = 128,
        oncrop,
        oncancel,
    }: {
        imageUrl: string
        outputSize?: number
        oncrop: (croppedUrl: string) => void
        oncancel: () => void
    } = $props()

    let t = $derived(planner.theme)

    let containerEl = $state<HTMLDivElement | null>(null)
    let canvasEl = $state<HTMLCanvasElement | null>(null)
    let image = $state<HTMLImageElement | null>(null)

    let viewportH = $state(700)

    let cw = $state(400)
    let ch = $state(400)

    let nw = $state(1)
    let nh = $state(1)

    let cropX = $state(0)
    let cropY = $state(0)
    let cropSize = $state(200)
    let zoom = $state(1)

    let dragMode: 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br' | null =
        $state(null)
    let dragStart = { mx: 0, my: 0, cx: 0, cy: 0, cs: 0 }

    let hasAdjusted = $state(false)

    let fitScale = $derived(Math.min(cw / nw, ch / nh))
    let dispScale = $derived(fitScale * zoom)

    let dispW = $derived(nw * dispScale)
    let dispH = $derived(nh * dispScale)
    let dispOffX = $derived((cw - dispW) / 2)
    let dispOffY = $derived((ch - dispH) / 2)

    let cropDispX = $derived(dispOffX + cropX * dispScale)
    let cropDispY = $derived(dispOffY + cropY * dispScale)
    let cropDispSize = $derived(cropSize * dispScale)

    let previewCanvasEl = $state<HTMLCanvasElement | null>(null)

    let initialCropX = $state(0)
    let initialCropY = $state(0)
    let initialCropSize = $state(0)

    onMount(() => {
        if (!containerEl) return
        const parent = containerEl.parentElement
        if (!parent) return
        viewportH = window.innerHeight
        const maxW = Math.min(parent.clientWidth - 32, 460)
        const nonCanvasH = outputSize >= 128 ? 60 : 40
        const maxH = Math.min(viewportH * 0.78 - nonCanvasH, 460)
        cw = Math.min(maxW, maxH)
        ch = cw
        loadImage(imageUrl)
    })

    function loadImage(src: string) {
        image = null
        const img = new Image()
        img.onload = () => {
            image = img
            nw = img.naturalWidth
            nh = img.naturalHeight
            cropSize = Math.min(nw, nh) * 0.6
            cropX = (nw - cropSize) / 2
            cropY = (nh - cropSize) / 2
            zoom = 1
            hasAdjusted = false
            initialCropX = cropX
            initialCropY = cropY
            initialCropSize = cropSize
            draw()
        }
        img.onerror = () => oncancel()
        img.src = src
    }

    $effect(() => {
        if (!image || nw <= 0) return
        draw()
    })

    function draw() {
        const ctx = canvasEl?.getContext('2d')
        if (!ctx || !image) return
        ctx.clearRect(0, 0, cw, ch)

        ctx.drawImage(image, dispOffX, dispOffY, dispW, dispH)

        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        const dx = cropDispX,
            dy = cropDispY,
            ds = cropDispSize
        ctx.fillRect(0, 0, cw, dy)
        ctx.fillRect(0, dy + ds, cw, ch - dy - ds)
        ctx.fillRect(0, dy, dx, ds)
        ctx.fillRect(dx + ds, dy, cw - dx - ds, ds)

        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        ctx.strokeRect(dx, dy, ds, ds)

        const hs = 10
        ctx.fillStyle = 'white'
        const corners = [
            [dx, dy],
            [dx + ds, dy],
            [dx, dy + ds],
            [dx + ds, dy + ds],
        ]
        for (const [hx, hy] of corners) {
            ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
        }

        if (previewCanvasEl) {
            const pctx = previewCanvasEl.getContext('2d')
            if (pctx) {
                pctx.clearRect(0, 0, outputSize, outputSize)
                pctx.drawImage(
                    image,
                    Math.round(cropX),
                    Math.round(cropY),
                    Math.round(cropSize),
                    Math.round(cropSize),
                    0,
                    0,
                    outputSize,
                    outputSize,
                )
            }
        }
    }

    function handleMousedown(e: MouseEvent) {
        if (!canvasEl) return
        const rect = canvasEl.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top

        const handle = getHandleAt(mx, my, cropDispX, cropDispY, cropDispSize)
        if (handle) {
            dragMode = handle as any
            dragStart = { mx, my, cx: cropX, cy: cropY, cs: cropSize }
            e.preventDefault()
            return
        }

        if (
            mx >= cropDispX &&
            mx <= cropDispX + cropDispSize &&
            my >= cropDispY &&
            my <= cropDispY + cropDispSize
        ) {
            dragMode = 'move'
            dragStart = { mx, my, cx: cropX, cy: cropY, cs: cropSize }
            e.preventDefault()
        }
    }

    function handleMousemove(e: MouseEvent) {
        if (!dragMode || !canvasEl) return
        const rect = canvasEl.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const dx = (mx - dragStart.mx) / dispScale
        const dy = (my - dragStart.my) / dispScale

        hasAdjusted = true

        if (dragMode === 'move') {
            let nx = Math.max(0, Math.min(nw - cropSize, dragStart.cx + dx))
            let ny = Math.max(0, Math.min(nh - cropSize, dragStart.cy + dy))
            cropX = nx
            cropY = ny
            return
        }

        const r = clampCropResize(dragMode, dragStart, dx, dy, nw, nh)
        cropX = r.cropX
        cropY = r.cropY
        cropSize = r.cropSize
    }

    function handleMouseup() {
        dragMode = null
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        zoom = Math.max(0.1, Math.min(10, zoom * factor))
        hasAdjusted = true
    }

    async function rotate(degrees: number) {
        if (!image) return
        const dataUrl = await rotateImageDataUrl(image?.src ?? '', degrees, nw, nh)
        loadImage(dataUrl)
    }

    async function tryClose() {
        if (hasAdjusted) {
            const ok = await dialog.confirm('裁剪位置已调整，确定要取消吗？')
            if (!ok) return
        }
        oncancel()
    }

    function doCrop() {
        if (!image) return
        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(
            image,
            Math.round(cropX),
            Math.round(cropY),
            Math.round(cropSize),
            Math.round(cropSize),
            0,
            0,
            outputSize,
            outputSize,
        )
        oncrop(canvas.toDataURL())
    }

    function handleWindowMousemove(e: MouseEvent) {
        if (!dragMode) return
        handleMousemove(e)
    }

    function handleWindowMouseup() {
        handleMouseup()
    }

    async function handleWindowKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            await tryClose()
        }
    }
</script>

<svelte:window
    onmousemove={handleWindowMousemove}
    onmouseup={handleWindowMouseup}
    onkeydown={handleWindowKeydown}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center"
    style="background: {t.overlayBackdrop};"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
>
    <div
        class="rounded-lg shadow-2xl flex flex-col"
        style="border: 1px solid {t.modalBorder}; background: {t.modalBg}; max-width: 90vw; max-height: 90vh;"
    >
        <div
            class="flex items-center gap-2 px-4 py-3 shrink-0"
            style="border-bottom: 1px solid {t.border};"
        >
            <span class="text-sm font-semibold flex-1" style="color: {t.text};">裁剪图片</span>
            <button
                class="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors"
                style="color: {t.textSecondary};"
                onmouseenter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = t.buttonHover
                    ;(e.currentTarget as HTMLElement).style.color = t.text
                }}
                onmouseleave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = ''
                    ;(e.currentTarget as HTMLElement).style.color = t.textSecondary
                }}
                onclick={tryClose}>✕</button
            >
        </div>
        <div class="p-4 flex flex-col sm:flex-row gap-4 overflow-y-auto min-h-0 scrollable-area">
            <div
                bind:this={containerEl}
                class="relative select-none overflow-hidden rounded shrink-0"
                style="width: {cw}px; height: {ch}px; background: #111;"
            >
                <canvas
                    bind:this={canvasEl}
                    width={cw}
                    height={ch}
                    class="absolute inset-0"
                    style="cursor: {cursorStyleUtil(dragMode)};"
                    onmousedown={handleMousedown}
                    onwheel={handleWheel}
                ></canvas>
            </div>
            {#snippet previewPanel()}
                {#if image}
                    <div class="flex flex-col items-center gap-2 shrink-0 w-full sm:w-auto">
                        <canvas
                            bind:this={previewCanvasEl}
                            width={outputSize}
                            height={outputSize}
                            class="rounded border shrink-0"
                            style="border-color: {t.border}; width: {outputSize *
                                2}px; height: {outputSize * 2}px; image-rendering: auto;"
                        ></canvas>
                        <div class="text-[10px]" style="color: {t.mutedText};">
                            {outputSize}×{outputSize} 预览
                        </div>
                        <div class="text-xs" style="color: {t.textSecondary};">
                            {((cropSize / nw) * 100).toFixed(0)}%
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                class="rounded px-2 py-1 text-[10px] transition-colors"
                                style="color: {t.textSecondary}; border: 1px solid {t.border};"
                                onclick={() => rotate(-90)}
                                title="向左旋转 90°">↺ 90°</button
                            >
                            <button
                                class="rounded px-2 py-1 text-[10px] transition-colors"
                                style="color: {t.textSecondary}; border: 1px solid {t.border};"
                                onclick={() => rotate(90)}
                                title="向右旋转 90°">↻ 90°</button
                            >
                        </div>
                        <div class="text-[10px]" style="color: {t.mutedText};">
                            拖拽移动 · 四角缩放 · 滚轮缩放
                        </div>
                        <div class="flex gap-2 mt-auto">
                            <button
                                class="rounded px-3 py-1.5 text-xs transition-colors"
                                style="background: {t.buttonBg}; color: {t.buttonText}; border: 1px solid {t.border};"
                                onclick={tryClose}>取消</button
                            >
                            <button
                                class="rounded px-3 py-1.5 text-xs transition-colors"
                                style="background: {t.confirmBtnBg}; color: #ffffff;"
                                onclick={doCrop}>确认裁剪</button
                            >
                        </div>
                    </div>
                {/if}
            {/snippet}
            {@render previewPanel()}
        </div>
    </div>
</div>

<style>
    .scrollable-area::-webkit-scrollbar {
        width: 6px;
    }
    .scrollable-area::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollable-area::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 3px;
    }
    .scrollable-area::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
    }
</style>
