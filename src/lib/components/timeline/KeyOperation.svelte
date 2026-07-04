<script lang="ts">
    import type { KeyOperation, Theme } from '$lib/types'
    import { MODE_LABELS } from '$lib/data/labels'
    import { showModeLabel } from '$lib/utils/keyops'
    import KeyIcon from './KeyIcon.svelte'
    import StrongBadge from './StrongBadge.svelte'

    let {
        op,
        theme,
        draggable = false,
    }: {
        op: KeyOperation
        theme: Theme
        draggable?: boolean
    } = $props()

    let modeColors = $derived(theme.modeColors)
</script>

{#if op.mode === 'click'}
    <div class="relative inline-flex">
        {#if op.strong}
            <div class="absolute -left-1.5 -top-3 z-10">
                <StrongBadge size={12} />
            </div>
        {/if}
        <KeyIcon key={op.key} size="sm" color={theme.nodeColors[op.key]} />
    </div>
{:else if showModeLabel(op)}
    <div
        class="inline-flex items-center rounded-sm relative"
        style="border: 1px solid {modeColors[
            op.mode
        ]}; background: transparent; gap: 2px; padding: 1px 2px 1px 3px; height: 20px;"
        class:cursor-grab={draggable}
        {draggable}
    >
        {#if op.strong}
            <div class="absolute -left-1.5 -top-3 z-10">
                <StrongBadge size={12} />
            </div>
        {/if}
        <span
            class="text-[10px] font-bold leading-none whitespace-nowrap"
            style="color: {modeColors[op.mode]};"
        >
            {MODE_LABELS[op.mode]}
        </span>
        <KeyIcon key={op.key} size="sm" color={theme.nodeColors[op.key]} mode={op.mode} />
    </div>
{:else}
    <div class="relative inline-flex">
        {#if op.strong}
            <div class="absolute -left-1.5 -top-3 z-10">
                <StrongBadge size={12} />
            </div>
        {/if}
        <KeyIcon key={op.key} size="sm" color={theme.nodeColors[op.key]} mode={op.mode} />
    </div>
{/if}
