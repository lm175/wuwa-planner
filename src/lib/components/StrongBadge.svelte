<script lang="ts">
    let {
        size = 12,
        color = '#eab308',
    }: {
        size?: number
        color?: string
    } = $props()

    let bg = $derived(color + '22')
    let fontSize = $derived(Math.max(9, size - 2))
</script>

<div
    class="inline-flex items-center justify-center rounded font-bold leading-none shrink-0"
    style="border: 1px solid {color}; background: {color}22; width: {size}px; height: {size}px; font-size: {fontSize}px; color: {color};"
>强</div>