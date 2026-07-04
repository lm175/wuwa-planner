<script lang="ts">
    import { scale } from 'svelte/transition'

    interface ContextMenuItem {
        label: string
        action: () => void
        disabled?: boolean
        color?: string
    }

    let { x = 0, y = 0, items = [] as ContextMenuItem[], onclose = () => {} } = $props()

    let ref = $state<HTMLDivElement>()
    let adjX = $state(0)
    let adjY = $state(0)

    $effect(() => {
        if (x <= 0 || y <= 0) {
            adjX = 0
            adjY = 0
            return
        }
        adjX = x
        adjY = y
        requestAnimationFrame(() => {
            if (!ref) return
            const r = ref.getBoundingClientRect()
            adjX = Math.max(4, Math.min(x, innerWidth - r.width - 4))
            adjY = Math.max(4, Math.min(y, innerHeight - r.height - 4))
        })
    })

    function handleAction(item: ContextMenuItem) {
        if (!item.disabled) {
            item.action()
            onclose()
        }
    }

    $effect(() => {
        if (x === 0 && y === 0) return
        function handleClick() {
            onclose()
        }
        requestAnimationFrame(() => document.addEventListener('click', handleClick, { once: true }))
        return () => document.removeEventListener('click', handleClick)
    })
</script>

{#if x > 0 && y > 0}
    <div
        bind:this={ref}
        class="fixed z-50 min-w-36 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
        style="left: {adjX}px; top: {adjY}px;"
        transition:scale={{ duration: 100, start: 0.95 }}
    >
        {#each items as item}
            <button
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40 hover:bg-zinc-700"
                disabled={item.disabled}
                onclick={() => handleAction(item)}
            >
                {#if item.color}
                    <span class="h-2 w-2 rounded-full" style="background: {item.color}"></span>
                {/if}
                {item.label}
            </button>
        {/each}
    </div>
{/if}
