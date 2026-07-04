<script lang="ts">
    import { onMount } from 'svelte'
    import { planner } from '$lib/stores/planner.svelte'
    import {
        getMergedTimeline,
        buildTextDescription,
        buildCharLines,
        buildIntroLines,
    } from '$lib/utils/rotation-description'
    import { getCharacterPresets, loadCharacterPresets } from '$lib/data/characters'
    import type { CharacterPreset } from '$lib/types'

    let { fillHeight = false }: { fillHeight?: boolean } = $props()

    let presets = $state<CharacterPreset[]>(getCharacterPresets())

    onMount(() => {
        loadCharacterPresets().then((p) => (presets = p))
    })

    let merged = $derived(
        getMergedTimeline(planner.characters, planner.blocks, planner.stayFieldMarkers, presets),
    )
    let text = $derived(buildTextDescription(merged))

    let copyMenuOpen = $state(false)
    let copyMenuX = $state(0)
    let copyMenuY = $state(0)

    function onDocClick() {
        copyMenuOpen = false
    }
    function onDocKey(e: KeyboardEvent) {
        if (e.key === 'Escape') copyMenuOpen = false
    }

    onMount(() => {
        document.addEventListener('click', onDocClick)
        document.addEventListener('keydown', onDocKey)
        return () => {
            document.removeEventListener('click', onDocClick)
            document.removeEventListener('keydown', onDocKey)
        }
    })

    function showCopyMenu(e: MouseEvent) {
        e.preventDefault()
        e.stopPropagation()
        copyMenuX = e.clientX
        copyMenuY = e.clientY
        copyMenuOpen = true
    }

    async function copyDirect(e: MouseEvent) {
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        copyMenuOpen = false
    }

    async function copyByChar(e: MouseEvent) {
        e.stopPropagation()
        const lines = buildCharLines(merged)
        await navigator.clipboard.writeText(lines)
        copyMenuOpen = false
    }

    async function copyByIntro(e: MouseEvent) {
        e.stopPropagation()
        const lines = buildIntroLines(merged)
        await navigator.clipboard.writeText(lines)
        copyMenuOpen = false
    }
</script>

<div
    class="flex flex-col min-w-0"
    style={fillHeight ? 'flex: 1; min-height: 0;' : 'height: 160px;'}
>
    <div
        class="flex-1 min-w-0 overflow-y-auto rounded-lg p-3"
        style="border: 1px solid {planner.theme.divider}; background: {planner.theme
            .trackBg}; scrollbar-width: thin;"
    >
        {#if merged.length === 0}
            <div
                class="flex h-full items-center justify-center text-xs"
                style="color: {planner.theme.mutedText};"
            >
                暂无排轴数据
            </div>
        {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="cursor-default whitespace-pre-wrap wrap-break-word text-sm select-text leading-relaxed font-medium"
                style="color: {planner.theme.text};"
                oncontextmenu={showCopyMenu}
            >
                {text}
            </div>
        {/if}
    </div>
</div>

{#snippet menuItem(action: (e: MouseEvent) => void, label: string)}
    <button
        class="flex w-full items-center px-4 py-2 text-left text-xs transition-colors"
        style="color: {planner.theme.text};"
        onmouseenter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = planner.theme.contextHover)}
        onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
        onclick={action}>{label}</button
    >
{/snippet}

{#if copyMenuOpen}
    <div
        class="fixed z-50 w-44 rounded-lg py-1 shadow-xl"
        style="left: {copyMenuX}px; top: {copyMenuY}px; border: 1px solid {planner.theme
            .contextBorder}; background: {planner.theme.contextBg};"
    >
        {@render menuItem(copyDirect, '直接复制')}
        {@render menuItem(copyByChar, '复制（按角色分行）')}
        {@render menuItem(copyByIntro, '复制（按变奏分行）')}
    </div>
{/if}
