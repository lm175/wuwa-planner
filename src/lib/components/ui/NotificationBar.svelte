<script lang="ts">
    import { fly } from 'svelte/transition'
    import { notification } from '$lib/stores/notification.svelte'
    import { planner } from '$lib/stores/planner.svelte'

    let s = $derived(notification.state)
    let t = $derived(planner.theme)
</script>

{#if s.visible}
    <div
        class="fixed top-4 left-1/2 z-200 -translate-x-1/2 flex items-center gap-2 rounded-lg px-4 py-2.5 shadow-xl text-sm"
        style="border: 1px solid {t.modalBorder}; background: {t.modalBg}; color: {t.text};"
        role="alert"
        transition:fly={{ duration: 300, y: -16 }}
    >
        <span class="i-[octicon--info-16] shrink-0" style="color: {t.accentText};"></span>
        <span>{s.message}</span>
        <button
            class="ml-2 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            style="color: {t.text};"
            onclick={() => notification.hide()}>✕</button
        >
    </div>
{/if}
