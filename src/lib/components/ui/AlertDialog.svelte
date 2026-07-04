<script lang="ts">
    import { fade, scale } from 'svelte/transition'
    import { dialog } from '$lib/stores/dialog.svelte'
    import { planner } from '$lib/stores/planner.svelte'

    let s = $derived(dialog.state)
    let t = $derived(planner.theme)
</script>

{#if s.visible}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-100 flex items-end sm:items-center sm:justify-center"
        style="background: {t.overlayBackdrop};"
        onclick={() => {}}
        onkeydown={() => {}}
        transition:fade={{ duration: 150 }}
    >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="w-full sm:w-80 rounded-t-xl sm:rounded-lg p-5 shadow-2xl"
            style="border: 1px solid {t.modalBorder}; background: {t.modalBg};"
            onclick={(e) => e.stopPropagation()}
            transition:scale={{ duration: 200, start: 0.92 }}
        >
            <div class="mb-4 text-sm leading-relaxed" style="color: {t.text};">
                {s.message}
            </div>
            <div class="flex justify-end gap-2">
                {#if s.type === 'confirm'}
                    <button
                        class="rounded px-3 py-1.5 text-xs transition-colors"
                        style="background: {t.buttonBg}; color: {t.buttonText};"
                        onmouseenter={(e) =>
                            ((e.target as HTMLElement).style.background = t.buttonHover)}
                        onmouseleave={(e) =>
                            ((e.target as HTMLElement).style.background = t.buttonBg)}
                        onclick={() => s.resolve(false)}>取消</button
                    >
                {/if}
                <button
                    class="rounded px-3 py-1.5 text-xs font-medium text-white transition-colors"
                    style="background: {s.type === 'alert' ? t.alertBtnBg : t.confirmBtnBg};"
                    onclick={() => s.resolve(true)}>{s.type === 'alert' ? '确定' : '确认'}</button
                >
            </div>
        </div>
    </div>
{/if}
