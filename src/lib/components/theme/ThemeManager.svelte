<script lang="ts">
    import { planner } from '$lib/stores/planner.svelte'
    import { themeStore } from '$lib/stores/themes.svelte'
    import { dialog } from '$lib/stores/dialog.svelte'
    import { downloadJSON } from '$lib/utils/download'
    import ThemeEditor from './ThemeEditor.svelte'
    import type { Theme } from '$lib/types'

    let { onclose }: { onclose?: () => void } = $props()

    let t = $derived(planner.theme)
    let allThemes = $derived(themeStore.getAllThemes())
    let activeTheme = $derived(themeStore.getActiveTheme())
    let isActiveBuiltin = $derived(!!activeTheme.isBuiltin)

    let editingTheme = $state<Theme | null>(null)
    let showEditor = $state(false)
    let newThemeBase = $state<'dark' | 'light'>('dark')

    let baseForNew = $derived.by(() => {
        const active = themeStore.getActiveTheme()
        if (active.isBuiltin) return active.key === 'light' ? 'light' : 'dark'
        return active.baseTheme === 'light' ? 'light' : 'dark'
    })

    function selectTheme(id: string) {
        planner.setTheme(id)
    }

    function startNewTheme() {
        const active = themeStore.getActiveTheme()
        newThemeBase = active.isBuiltin
            ? active.key === 'light'
                ? 'light'
                : 'dark'
            : active.baseTheme === 'light'
              ? 'light'
              : 'dark'
        showEditor = true
        editingTheme = null
    }

    function startEdit(theme: Theme) {
        editingTheme = theme
        showEditor = true
    }

    function handleSave(updated: Theme) {
        if (editingTheme && !editingTheme.isBuiltin) {
            themeStore.updateCustomTheme(editingTheme.id, updated)
        } else {
            const { id: _id, isBuiltin: _ib, ...rest } = updated
            themeStore.addCustomTheme({ ...rest, baseTheme: newThemeBase })
        }
        showEditor = false
        editingTheme = null
    }

    async function handleDelete(themeId: string) {
        const theme = allThemes.find((t) => t.id === themeId)
        if (!theme) return
        const ok = await dialog.confirm(`确定要删除主题「${theme.name}」吗？`)
        if (!ok) return
        themeStore.removeCustomTheme(themeId)
    }

    function handleCancel() {
        showEditor = false
        editingTheme = null
    }

    function diffThemeForExport(theme: Theme): Record<string, unknown> {
        const baseKey = theme.baseTheme ?? 'dark'
        const base = themeStore.getTheme(baseKey)
        if (!base) return { ...theme } as unknown as Record<string, unknown>

        const COLOR_FIELDS = [
            'background',
            'trackBg',
            'text',
            'textSecondary',
            'mutedText',
            'panelBg',
            'exportBg',
            'sidebarBg',
            'sidebarBorder',
            'sidebarText',
            'sidebarTextActive',
            'sidebarHover',
            'border',
            'borderLight',
            'divider',
            'inputBg',
            'inputBorder',
            'buttonBg',
            'buttonHover',
            'buttonText',
            'blockBorder',
            'blockCompactBorder',
            'blockCompactBg',
            'diagramItemBorder',
            'deleteBtnBorder',
            'deleteBtnHover',
            'scrollbarTrack',
            'scrollbarThumb',
            'scrollbarThumbHover',
            'ringOffset',
            'overlayBackdrop',
            'dragOverBg',
            'selectedModeBg',
            'selectedModeRing',
            'alertBtnBg',
            'confirmBtnBg',
            'modalBg',
            'modalBorder',
            'contextBg',
            'contextBorder',
            'contextHover',
            'badgeText',
            'avatarText',
            'accentText',
            'accentHover',
            'dangerText',
            'dangerHover',
            'segmentLabel',
            'comboText',
            'tagBg',
            'tagText',
            'stayField',
            'wrapIndicator',
            'fallbackTrack',
            'comboBg',
            'comboBorder',
            'starRarity5',
            'starRarity4',
            'starRoverGradient',
        ]

        const result: Record<string, unknown> = { baseTheme: baseKey, name: theme.name }

        for (const field of COLOR_FIELDS) {
            if ((theme as any)[field] !== (base as any)[field]) {
                result[field] = (theme as any)[field]
            }
        }

        if (JSON.stringify(theme.nodeColors) !== JSON.stringify(base.nodeColors)) {
            result.nodeColors = theme.nodeColors
        }
        if (JSON.stringify(theme.modeColors) !== JSON.stringify(base.modeColors)) {
            result.modeColors = theme.modeColors
        }
        if (theme.keyIcons && JSON.stringify(theme.keyIcons) !== JSON.stringify(base.keyIcons)) {
            result.keyIcons = theme.keyIcons
        }
        if (theme.strongBadgeIcon !== base.strongBadgeIcon) {
            result.strongBadgeIcon = theme.strongBadgeIcon
        }
        if (
            theme.avatarOverrides &&
            JSON.stringify(theme.avatarOverrides) !== JSON.stringify(base.avatarOverrides)
        ) {
            result.avatarOverrides = theme.avatarOverrides
        }

        return result
    }

    function handleExportTheme() {
        const active = themeStore.getActiveTheme()
        const diff = diffThemeForExport(active)
        const json = JSON.stringify(diff, null, 2)
        const name = active.name.replace(/[/\\?%*:|"<>]/g, '_')
        downloadJSON(json, `${name}.theme.json`)
    }

    function handleImportTheme() {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            try {
                const text = await file.text()
                const parsed = JSON.parse(text)

                if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    await dialog.alert('导入失败：主题数据必须是一个 JSON 对象')
                    return
                }

                const data = parsed as Record<string, unknown>

                if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                    await dialog.alert('导入失败：主题缺少名称（name）')
                    return
                }

                const baseKey = (data.baseTheme as string) || 'dark'
                if (baseKey !== 'dark' && baseKey !== 'light') {
                    await dialog.alert('导入失败：baseTheme 必须为 "dark" 或 "light"')
                    return
                }

                const baseTheme = themeStore.getTheme(baseKey)
                if (!baseTheme) {
                    await dialog.alert(`导入失败：找不到基础主题 "${baseKey}"`)
                    return
                }

                const {
                    id: _id,
                    isBuiltin: _ib,
                    ...merged
                } = { ...baseTheme, ...data, isBuiltin: false } as Theme
                themeStore.addCustomTheme(merged as any)
            } catch {
                await dialog.alert('导入失败：无法解析 JSON 文件')
            }
        }
        input.click()
    }
</script>

<div
    class="flex flex-col gap-3 w-full overflow-x-auto"
    style="max-width: 600px; max-height: 75vh; min-width: 0; --scrollbar-track: {t.scrollbarTrack}; --scrollbar-thumb: {t.scrollbarThumb}; --scrollbar-thumb-hover: {t.scrollbarThumbHover};"
>
    {#if showEditor}
        {#if editingTheme}
            <ThemeEditor theme={editingTheme} onsave={handleSave} oncancel={handleCancel} />
        {:else}
            <ThemeEditor
                theme={themeStore.getTheme(baseForNew)!}
                onsave={handleSave}
                oncancel={handleCancel}
            />
        {/if}
    {:else}
        <div class="flex flex-col gap-1 overflow-y-auto min-h-0 scrollable-area" style="flex: 1;">
            {#each allThemes as theme}
                <div
                    class="flex items-center gap-2 rounded px-3 py-2 cursor-pointer transition-colors"
                    style="background: {themeStore.activeThemeId === theme.id
                        ? t.selectedModeBg
                        : 'transparent'}; border: 1px solid {themeStore.activeThemeId === theme.id
                        ? t.selectedModeRing
                        : 'transparent'};"
                    onclick={() => selectTheme(theme.id)}
                    onkeydown={(e) => e.key === 'Enter' && selectTheme(theme.id)}
                    role="option"
                    aria-selected={themeStore.activeThemeId === theme.id}
                    tabindex="0"
                >
                    <div
                        class="w-4 h-4 rounded-full shrink-0"
                        style="background: {theme.isBuiltin
                            ? theme.background
                            : theme.accentText}; border: 1px solid {theme.border};"
                    ></div>
                    <span class="text-xs font-medium flex-1" style="color: {t.text};">
                        {theme.name}
                        {#if theme.isBuiltin}
                            <span class="text-[10px]" style="color: {t.mutedText};">(内置)</span>
                        {/if}
                    </span>
                    {#if themeStore.activeThemeId === theme.id}
                        <span class="text-[10px]" style="color: {t.accentText};">使用中</span>
                    {/if}
                </div>
            {/each}
        </div>
        {#if onclose}
            <div class="shrink-0" style="border-top: 1px solid {t.divider};"></div>
            <div class="flex items-center justify-between shrink-0 pt-1">
                <div class="flex items-center gap-0">
                    {#if !isActiveBuiltin}
                        <button
                            class="px-1.5 py-0.5 text-[11px] transition-colors rounded"
                            style="color: {t.dangerText};"
                            onmouseenter={(e) => (e.currentTarget.style.opacity = '0.7')}
                            onmouseleave={(e) => (e.currentTarget.style.opacity = '1')}
                            onclick={() => handleDelete(activeTheme.id)}>删除</button
                        >
                        <button
                            class="px-1.5 py-0.5 text-[11px] transition-colors rounded"
                            style="color: {t.textSecondary};"
                            onmouseenter={(e) => (e.currentTarget.style.color = t.text)}
                            onmouseleave={(e) => (e.currentTarget.style.color = t.textSecondary)}
                            onclick={() => startEdit(activeTheme)}>编辑</button
                        >
                        <button
                            class="px-1.5 py-0.5 text-[11px] transition-colors rounded"
                            style="color: {t.textSecondary};"
                            onmouseenter={(e) => (e.currentTarget.style.color = t.text)}
                            onmouseleave={(e) => (e.currentTarget.style.color = t.textSecondary)}
                            onclick={handleExportTheme}>导出</button
                        >
                    {/if}
                </div>
                <div class="flex items-center gap-0">
                    <button
                        class="px-1.5 py-0.5 text-[11px] transition-colors rounded"
                        style="color: {t.textSecondary};"
                        onmouseenter={(e) => (e.currentTarget.style.color = t.text)}
                        onmouseleave={(e) => (e.currentTarget.style.color = t.textSecondary)}
                        onclick={handleImportTheme}>导入</button
                    >
                    <button
                        class="px-1.5 py-0.5 text-[11px] transition-colors rounded"
                        style="color: {t.accentText};"
                        onmouseenter={(e) => (e.currentTarget.style.opacity = '0.7')}
                        onmouseleave={(e) => (e.currentTarget.style.opacity = '1')}
                        onclick={startNewTheme}>+ 新建</button
                    >
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .scrollable-area::-webkit-scrollbar {
        width: 6px;
    }
    .scrollable-area::-webkit-scrollbar-track {
        background: var(--scrollbar-track, #27272a);
    }
    .scrollable-area::-webkit-scrollbar-thumb {
        background: var(--scrollbar-thumb, #3f3f46);
        border-radius: 3px;
    }
    .scrollable-area::-webkit-scrollbar-thumb:hover {
        background: var(--scrollbar-thumb-hover, #52525b);
    }
</style>
