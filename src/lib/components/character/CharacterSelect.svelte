<script lang="ts">
    import { onMount } from 'svelte'
    import type { Character, CharacterPreset } from '$lib/types'
    import { loadCharacterPresets, getCharacterPresets } from '$lib/data/characters'
    import { planner } from '$lib/stores/planner.svelte'
    import { findCharWithPreset } from '$lib/utils/characters'
    import CharacterPicker from './CharacterPicker.svelte'
    import Modal from '$lib/components/ui/Modal.svelte'

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
    let presets = $state<CharacterPreset[]>(getCharacterPresets())

    let swapPending = $state<{
        targetCharId: string
        targetName: string
        presetId: string
    } | null>(null)

    onMount(() => {
        loadCharacterPresets().then((p) => (presets = p))
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

    function selectPreset(presetId: string) {
        const existing = findCharWithPreset(planner.characters, character.id, presetId)
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

    function handleClose() {
        isOpen = false
        swapPending = null
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
    <CharacterPicker
        selectedId={character.presetId ?? ''}
        onselect={selectPreset}
        onclose={handleClose}
    />
{/if}

<Modal open={swapPending !== null} title="交换角色" onclose={cancelSwap}>
    <p class="mb-4 text-center text-sm" style="color: {planner.theme.text};">
        {swapPending?.targetName} 已选择该角色，是否交换？
    </p>
    <div class="flex justify-center gap-3">
        <button
            class="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors"
            style="background: {planner.theme.accentText};"
            onclick={confirmSwap}>交换</button
        >
        <button
            class="rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
            style="background: {planner.theme.buttonBg}; color: {planner.theme.buttonText};"
            onclick={cancelSwap}>取消</button
        >
    </div>
</Modal>
