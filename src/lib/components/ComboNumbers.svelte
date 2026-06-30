<script lang="ts">
    import type { Theme } from '$lib/types';

    let { start, end, theme }: {
        start?: number;
        end?: number;
        theme: Theme;
    } = $props();

    let nums = $derived.by(() => {
        if (!start || !end || start <= 0 || end <= 0) return null;
        if (start === end) return String(start);
        const arr: number[] = [];
        for (let n = start; n <= end; n++) arr.push(n);
        return arr.join('');
    });

    let bgColor = $derived(theme.key === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)');
    let textColor = $derived(theme.key === 'light' ? '#000000' : '#ffffff');
</script>

{#if nums}
    <span class="-ml-2 pl-2 pr-1 rounded h-5 flex items-center font-black"
        style="font-size: 10px; padding-top: 0; padding-bottom: 0; background: {bgColor}; color: {textColor};"
    >{nums}</span>
{/if}
