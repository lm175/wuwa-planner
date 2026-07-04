<script lang="ts">
    import { fade, scale } from 'svelte/transition'
    import { planner } from '$lib/stores/planner.svelte'

    let {
        open = false,
        title = '',
        onclose = () => {},
        children,
    }: {
        open?: boolean
        title?: string
        onclose?: () => void
        children?: import('svelte').Snippet
    } = $props()

    let t = $derived(planner.theme)
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
        style="background: {t.overlayBackdrop};"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        transition:fade={{ duration: 150 }}
    >
        <div
            class="w-full sm:w-auto sm:min-w-80 max-w-lg rounded-t-xl sm:rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            style="border: 1px solid {t.modalBorder}; background: {t.modalBg};"
            transition:scale={{ duration: 200, start: 0.92 }}
        >
            {#if title}
                <div
                    class="flex items-center justify-between px-4 py-3"
                    style="border-bottom: 1px solid {t.border};"
                >
                    <h3 class="text-sm font-semibold" style="color: {t.text};">{title}</h3>
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
                        onclick={onclose}>✕</button
                    >
                </div>
            {/if}
            <div class="p-4">
                {@render children?.()}
            </div>
        </div>
    </div>
{/if}
