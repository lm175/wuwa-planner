<script lang="ts">
    import { onMount } from 'svelte'
    import type { Character, ElementType, CharacterPreset } from '$lib/types'
    import { loadCharacterPresets, getCharacterPresets } from '$lib/data/characters'
    import { ELEMENT_TYPE_MAP } from '$lib/data/labels'
    import { planner } from '$lib/stores/planner.svelte'
    import StarRating from './StarRating.svelte'

    let {
        character,
        index = 0,
        openTrigger = { index: -1, nonce: 0 },
    }: {
        character: Character
        index?: number
        openTrigger?: { index: number; nonce: number }
    } = $props()

    let isOpen = $state(false)

    let prevNonce = $state(0)
    $effect(() => {
        if (openTrigger.index === index && openTrigger.nonce !== prevNonce) {
            isOpen = true
            prevNonce = openTrigger.nonce
        }
    })
    let search = $state('')
    let presets = $state<CharacterPreset[]>(getCharacterPresets())

    let swapPending = $state<{
        targetCharId: string
        targetName: string
        presetId: string
    } | null>(null)

    let listEl = $state<HTMLDivElement | null>(null)

    const elementOrder: ElementType[] = ['glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc']

    onMount(() => {
        loadCharacterPresets().then((p) => (presets = p))
    })

    let filtered = $derived.by(() => {
        const q = search.trim().toLowerCase()
        if (!q) return presets
        return presets.filter(
            (p) =>
                p.name.includes(q) ||
                p.nameEn.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q),
        )
    })

    let grouped = $derived.by(() => {
        const groups = new Map<ElementType, CharacterPreset[]>()
        for (const el of elementOrder) {
            const items = filtered.filter((p) => p.element === el)
            if (items.length > 0) groups.set(el, items)
        }
        return groups
    })

    let charIdx = $derived(planner.characters.findIndex((c) => c.id === character.id))
    let trackColor = $derived(planner.getTrackColor(character.id, charIdx))

    let currentPreset = $derived(
        character.presetId ? presets.find((p) => p.id === character.presetId) : undefined,
    )
    let avatarPath = $derived(
        currentPreset
            ? (planner.theme.avatarOverrides?.[currentPreset.id] ??
                  `/images/avatars/${currentPreset.id}.png`)
            : null,
    )
    let avatarFailed = $state(false)

    function findCharWithPreset(presetId: string): Character | undefined {
        return planner.characters.find((c) => c.id !== character.id && c.presetId === presetId)
    }

    function selectPreset(presetId: string) {
        const existing = findCharWithPreset(presetId)
        if (existing) {
            swapPending = {
                targetCharId: existing.id,
                targetName: existing.name,
                presetId,
            }
            return
        }
        applyPreset(presetId)
    }

    function applyPreset(presetId: string) {
        const preset = presets.find((p) => p.id === presetId)
        if (preset) {
            planner.updateCharacter(character.id, {
                name: preset.name,
                presetId: preset.id,
            })
        }
        isOpen = false
    }

    function confirmSwap() {
        if (!swapPending) return
        const preset = presets.find((p) => p.id === swapPending!.presetId)
        if (preset) {
            planner.swapCharacterPresets(character.id, swapPending.targetCharId)
        }
        swapPending = null
        isOpen = false
    }

    function cancelSwap() {
        swapPending = null
    }

    function scrollToElement(el: ElementType) {
        if (!listEl) return
        const header = listEl.querySelector(`[data-element="${el}"]`) as HTMLElement | null
        if (header) header.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
</script>

<button
    class="relative h-14 w-14 overflow-hidden rounded-full transition-opacity hover:opacity-80"
    style="border: 2px solid {trackColor.border};"
    onclick={() => (isOpen = true)}
    title={character.name}
>
    {#if avatarPath && !avatarFailed}
        <img
            src={avatarPath}
            alt={character.name}
            class="h-full w-full object-cover"
            onerror={() => (avatarFailed = true)}
        />
    {/if}
    {#if !avatarPath || avatarFailed}
        <div class="flex h-full w-full items-center justify-center text-xl font-bold text-white">
            {character.name.charAt(0)}
        </div>
    {/if}
</button>

{#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style="background: {planner.theme.overlayBackdrop};"
        onkeydown={(e) => e.key === 'Escape' && (isOpen = false) && (swapPending = null)}
    >
        <div
            class="relative flex w-96 rounded-xl shadow-2xl"
            style="border: 1px solid {planner.theme.modalBorder}; background: {planner.theme
                .modalBg};"
        >
            <div class="flex min-w-0 flex-1 flex-col">
                <div
                    class="flex items-center justify-between p-4"
                    style="border-bottom: 1px solid {planner.theme.border};"
                >
                    <h3 class="text-base font-bold" style="color: {planner.theme.text};">
                        选择角色
                    </h3>
                    <button
                        class="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors"
                        style="color: {planner.theme.textSecondary};"
                        onmouseenter={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background =
                                planner.theme.buttonHover
                            ;(e.currentTarget as HTMLElement).style.color = planner.theme.text
                        }}
                        onmouseleave={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = ''
                            ;(e.currentTarget as HTMLElement).style.color =
                                planner.theme.textSecondary
                        }}
                        onclick={() => {
                            isOpen = false
                            swapPending = null
                        }}>✕</button
                    >
                </div>

                <div class="relative p-3">
                    <svg
                        class="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        style="color: {planner.theme.textSecondary};"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="搜索角色（拼音/汉字/英文名）..."
                        bind:value={search}
                        class="w-full rounded-lg py-2 pl-8 pr-3 text-sm"
                        style="border: 1px solid {planner.theme.inputBorder}; background: {planner
                            .theme.inputBg}; color: {planner.theme.text};"
                    />
                </div>

                <div class="overflow-y-auto scrollbar-dark-thick px-3 pb-3 dropdown-list" bind:this={listEl}>
                    {#each [...grouped.entries()] as [element, presets]}
                        <div class="mb-2 mt-3" data-element={element}>
                            <div
                                class="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider"
                                style="color: {planner.theme.textSecondary};"
                            >
                                {ELEMENT_TYPE_MAP[element] || element}
                            </div>
                            {#each presets as preset}
                                {@const sel = character.presetId === preset.id}
                                <button
                                    class="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                                    style="background: {sel
                                        ? planner.theme.contextHover
                                        : 'transparent'};"
                                    onmouseenter={(e) => {
                                        if (!sel)
                                            (e.currentTarget as HTMLElement).style.background =
                                                planner.theme.contextHover
                                    }}
                                    onmouseleave={(e) => {
                                        if (!sel)
                                            (e.currentTarget as HTMLElement).style.background =
                                                'transparent'
                                    }}
                                    onclick={() => selectPreset(preset.id)}
                                >
                                    <div
                                        class="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
                                    >
                                        <img
                                            src={planner.theme.avatarOverrides?.[preset.id] ??
                                                `/images/avatars/${preset.id}.png`}
                                            alt={preset.name}
                                            class="absolute inset-0 z-10 h-full w-full object-cover"
                                            onerror={(e) =>
                                                ((e.target as HTMLElement).style.display = 'none')}
                                        />
                                        <div
                                            class="flex h-full w-full items-center justify-center text-sm font-bold"
                                            style="color: {planner.theme.avatarText};"
                                        >
                                            {preset.name.charAt(0)}
                                        </div>
                                    </div>
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="text-sm font-bold"
                                                style="color: {planner.theme.text};"
                                                >{preset.name}</span
                                            >
                                            <StarRating {preset} size={11} />
                                        </div>
                                        <span
                                            class="text-xs font-medium flex"
                                            style="color: {planner.theme.textSecondary};"
                                            >{preset.nameEn}</span
                                        >
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div
                            class="flex h-32 items-center justify-center text-sm"
                            style="color: {planner.theme.mutedText};"
                        >
                            未找到匹配角色
                        </div>
                    {/each}
                </div>
            </div>

            <div
                class="flex flex-col items-center justify-center gap-2 px-2 py-3"
                style="border-left: 1px solid {planner.theme.border};"
            >
                {#each elementOrder as el}
                    <button
                        class="h-7 w-7 overflow-hidden rounded opacity-60 transition-opacity hover:opacity-100"
                        title={ELEMENT_TYPE_MAP[el] || el}
                        onclick={() => scrollToElement(el)}
                    >
                        <img
                            src={`/images/elements/${el}.png`}
                            alt={ELEMENT_TYPE_MAP[el] || el}
                            class="h-full w-full object-cover"
                        />
                    </button>
                {/each}
            </div>
        </div>

        {#if swapPending}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
                style="background: {planner.theme.overlayBackdrop};"
                onclick={(e) => e.stopPropagation()}
            >
                <div
                    class="mx-4 w-72 rounded-lg p-5 shadow-xl"
                    style="border: 1px solid {planner.theme.contextBorder}; background: {planner
                        .theme.contextBg};"
                >
                    <p class="mb-4 text-center text-sm" style="color: {planner.theme.text};">
                        {swapPending.targetName} 已选择该角色，是否交换？
                    </p>
                    <div class="flex justify-center gap-3">
                        <button
                            class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors"
                            style="background: {planner.theme.accentText};"
                            onclick={confirmSwap}>交换</button
                        >
                        <button
                            class="rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
                            style="background: {planner.theme.buttonBg}; color: {planner.theme
                                .buttonText};"
                            onclick={cancelSwap}>取消</button
                        >
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}
