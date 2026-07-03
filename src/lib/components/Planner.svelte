<script lang="ts">
    import { onMount } from 'svelte'
    import { planner } from '$lib/stores/planner.svelte'
    import { projects } from '$lib/stores/projects.svelte'
    import { themeStore } from '$lib/stores/themes.svelte'
    import { loadCharacterPresets } from '$lib/data/characters'
    import Sidebar from './Sidebar.svelte'
    import AlertDialog from './ui/AlertDialog.svelte'
    import TimelineArea from './timeline/TimelineArea.svelte'
    import ActionPalette from './timeline/ActionPalette.svelte'
    import CharacterSelect from './character/CharacterSelect.svelte'
    import RotationDescription from './timeline/RotationDescription.svelte'
    import WrappedTimeline from './timeline/WrappedTimeline.svelte'
    import Modal from './ui/Modal.svelte'
    import ThemeManager from './theme/ThemeManager.svelte'
    import type { KeyType, KeyMode } from '$lib/types'

    let selectedKey = $state<KeyType>('Q')
    let selectedMode = $state<KeyMode>('click')
    let comboA = $state(0)
    let comboB = $state(0)
    let strong = $state(false)
    let comment = $state('')
    let openCharTrigger = $state<{ index: number; nonce: number }>({
        index: -1,
        nonce: 0,
    })
    let sidebarCollapsed = $state(false)
    let lastSaveTime = $state<string>('')
    let showDescription = $state(false)
    let themeOpen = $state(false)
    let themeManagerOpen = $state(false)

    onMount(() => {
        loadCharacterPresets().then(() => {
            projects.loadFromStorage()
            if (projects.projects.length > 0) {
                const id = projects.projects[0].id
                projects.loadProjectToPlanner(id)
            } else {
                const id = projects.addProject('未命名轴')
                projects.setActiveId(id)
                planner.initDefaults()
                projects.syncPlannerToActive()
            }
        })

        const saveTimer = setInterval(() => {
            projects.syncPlannerToActive()
            const now = new Date()
            lastSaveTime = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
        }, 5000)

        const mql = window.matchMedia('(max-width: 767px)')
        sidebarCollapsed = mql.matches
        const handleChange = (e) => {
            sidebarCollapsed = e.matches
        }
        mql.addEventListener('change', handleChange)

        return () => {
            clearInterval(saveTimer)
            mql.removeEventListener('change', handleChange)
        }
    })

    let titleValue = $state('')

    $effect(() => {
        titleValue = projects.activeProject?.title ?? ''
    })

    $effect(() => {
        const t = planner.theme
        const root = document.documentElement
        root.style.setProperty('--color-scrollbar-track', t.scrollbarTrack)
        root.style.setProperty('--color-scrollbar-thumb', t.scrollbarThumb)
        root.style.setProperty('--color-scrollbar-thumb-hover', t.scrollbarThumbHover)
        root.style.setProperty('--color-theme-text', t.text)
        root.style.setProperty('--color-theme-text-secondary', t.textSecondary)
        root.style.setProperty('--color-theme-bg', t.background)
        root.style.setProperty('--color-theme-border', t.border)
        root.style.setProperty('--color-theme-input-bg', t.inputBg)
        root.style.setProperty('--color-theme-input-border', t.inputBorder)
        root.style.setProperty('--color-theme-button-bg', t.buttonBg)
        root.style.setProperty('--color-theme-button-hover', t.buttonHover)
    })

    const keyMap: Record<string, KeyType> = {
        a: 'LMB',
        z: 'LMB',
        s: 'RMB',
        q: 'Q',
        e: 'E',
        r: 'R',
        t: 'T',
        f: 'F',
        x: 'X',
        v: 'V',
        ' ': 'jump',
    }

    const immediateHoldKeys = new Set(['z'])
    const keyOrder: KeyType[] = ['LMB', 'RMB', 'Q', 'E', 'R', 'T', 'F', 'X', 'V', 'jump']
    const modeOrder: KeyMode[] = [
        'click',
        'hold',
        'preinput_swap',
        'preinput_action',
        'rapid_click',
    ]

    let holdTimer: ReturnType<typeof setTimeout> | null = null
    let heldKey: string | null = null

    function isInputFocused(): boolean {
        const tag = document.activeElement?.tagName.toLowerCase()
        return (
            tag === 'input' ||
            tag === 'textarea' ||
            (document.activeElement as HTMLElement)?.isContentEditable === true
        )
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (showDescription) return
        if (isInputFocused()) return
        const key = e.key.toLowerCase()

        if (key in keyMap) {
            e.preventDefault()
            selectedKey = keyMap[key]
            selectedMode = immediateHoldKeys.has(key) ? 'hold' : 'click'
            heldKey = key
            if (!immediateHoldKeys.has(key)) {
                holdTimer = setTimeout(() => {
                    if (heldKey === key) selectedMode = 'hold'
                }, 400)
            }
            return
        }

        if (key === 'w') {
            e.preventDefault()
            const idx = modeOrder.indexOf(selectedMode)
            selectedMode = modeOrder[(idx + 1 + modeOrder.length) % modeOrder.length]
            return
        }

        if (key === 'arrowup' || key === 'arrowdown') {
            e.preventDefault()
            const idx = keyOrder.indexOf(selectedKey)
            const dir = key === 'arrowup' ? -1 : 1
            selectedKey = keyOrder[(idx + dir + keyOrder.length) % keyOrder.length]
            return
        }

        if (key === 'arrowleft' || key === 'arrowright') {
            e.preventDefault()
            const idx = modeOrder.indexOf(selectedMode)
            const dir = key === 'arrowright' ? 1 : -1
            selectedMode = modeOrder[(idx + dir + modeOrder.length) % modeOrder.length]
            return
        }
    }

    function handleKeyUp(e: KeyboardEvent) {
        if (holdTimer) {
            clearTimeout(holdTimer)
            holdTimer = null
        }
        heldKey = null
    }
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    id="planner-container"
    class="flex h-screen"
    style="font-family: {planner.theme.fontFamily};"
    oncontextmenu={(e) => e.preventDefault()}
>
    <Sidebar collapsed={sidebarCollapsed} ontoggle={() => (sidebarCollapsed = !sidebarCollapsed)} />

    <div
        class="flex flex-1 flex-col transition-all duration-200"
        style="min-width: 0; background: {planner.theme.background};"
    >
        <div
            class="flex items-center gap-3 px-3 py-2 min-w-0"
            style="border-bottom: 1px solid {planner.theme.border};"
        >
            <button
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm transition-colors"
                style="color: {planner.theme.textSecondary};"
                onmouseenter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = planner.theme.buttonHover
                    ;(e.currentTarget as HTMLElement).style.color = planner.theme.text
                }}
                onmouseleave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = ''
                    ;(e.currentTarget as HTMLElement).style.color = planner.theme.textSecondary
                }}
                onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
                >{sidebarCollapsed ? '☰' : '✕'}</button
            >
            <input
                type="text"
                value={titleValue}
                oninput={(e) => {
                    const v = (e.target as HTMLInputElement).value
                    titleValue = v
                    planner.title = v
                    if (projects.activeId) projects.renameProject(projects.activeId, v)
                }}
                class="min-w-0 flex-1 rounded px-2 py-1 text-sm font-bold"
                style="border: 1px solid {planner.theme.inputBorder}; background: {planner.theme
                    .inputBg}; color: {planner.theme.text};"
                placeholder="工程名称"
            />
            <div class="relative shrink-0">
                <button
                    class="font-black rounded px-2 py-1 text-[11px] transition-colors"
                    style="border: 1px solid {planner.theme.inputBorder}; color: {planner.theme
                        .textSecondary};"
                    onmouseenter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background =
                            planner.theme.buttonHover
                        ;(e.currentTarget as HTMLElement).style.color = planner.theme.text
                    }}
                    onmouseleave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = ''
                        ;(e.currentTarget as HTMLElement).style.color = planner.theme.textSecondary
                    }}
                    onclick={() => (themeOpen = !themeOpen)}
                    >{themeStore.getTheme(themeStore.activeThemeId)?.name ?? '主题'}</button
                >
                {#if themeOpen}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="absolute right-0 top-full mt-1 w-36 rounded-lg py-1 shadow-xl z-50"
                        style="border: 1px solid {planner.theme.contextBorder}; background: {planner
                            .theme.contextBg};"
                        onclick={() => (themeOpen = false)}
                    >
                        {#each themeStore.getAllThemes() as t}
                            <button
                                class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
                                style="color: {themeStore.activeThemeId === t.id
                                    ? planner.theme.accentText
                                    : planner.theme.textSecondary};"
                                onmouseenter={(e) => {
                                    if (themeStore.activeThemeId !== t.id)
                                        (e.target as HTMLElement).style.background =
                                            planner.theme.contextHover
                                }}
                                onmouseleave={(e) => {
                                    if (themeStore.activeThemeId !== t.id)
                                        (e.target as HTMLElement).style.background = ''
                                }}
                                onclick={() => {
                                    planner.setTheme(t.id)
                                    themeOpen = false
                                }}>{t.name}</button
                            >
                        {/each}
                        <div
                            class="border-t mt-1 pt-1"
                            style="border-color: {planner.theme.border};"
                        >
                            <button
                                class="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors"
                                style="color: {planner.theme.accentText};"
                                onmouseenter={(e) => {
                                    ;(e.target as HTMLElement).style.background =
                                        planner.theme.contextHover
                                }}
                                onmouseleave={(e) => {
                                    ;(e.target as HTMLElement).style.background = ''
                                }}
                                onclick={() => {
                                    themeOpen = false
                                    themeManagerOpen = true
                                }}>管理主题</button
                            >
                        </div>
                    </div>
                {/if}
            </div>
            <button
                class="font-black shrink-0 rounded px-2.5 py-1 text-[11px] transition-colors"
                style="border: 1px solid {planner.theme.inputBorder}; color: {planner.theme
                    .textSecondary};"
                onmouseenter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = planner.theme.buttonHover
                    ;(e.currentTarget as HTMLElement).style.color = planner.theme.text
                }}
                onmouseleave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = ''
                    ;(e.currentTarget as HTMLElement).style.color = planner.theme.textSecondary
                }}
                onclick={() => (showDescription = true)}>总览</button
            >
        </div>
        <div class="flex flex-1 flex-col min-h-0">
            <div class="flex-1 min-h-0 p-3 pb-0 overflow-hidden timeline-area">
                <TimelineArea {selectedKey} {selectedMode} {comboA} {comboB} {strong} {comment} />
            </div>

            <div
                class="bottom-panel flex gap-3 px-4 py-4 min-w-0 flex-col md:flex-row min-h-[50vh]"
                style="border-top: 1px solid {planner.theme.border};"
            >
                <div class="min-w-[320px] flex-1 overflow-y-auto overflow-x-auto max-h-[40vh] min-h-[150px] md:max-h-none">
                    <ActionPalette
                        theme={planner.theme}
                        bind:selectedKey
                        bind:selectedMode
                        bind:comboA
                        bind:comboB
                        bind:strong
                        bind:comment
                    />
                </div>
                <div
                    class="relative flex min-w-[320px] md:min-w-0 flex-col rounded-lg px-4 py-3 overflow-y-auto max-h-[40vh] md:max-h-none"
                    style="border: 1px solid {planner.theme.border}; background: {planner.theme.panelBg};"
                >
                    <div class="mb-2 flex items-center justify-between">
                        <span
                            class="text-[11px] font-bold"
                            style="color: {planner.theme.textSecondary};">队伍配置</span
                        >
                    </div>
                    <div class="flex flex-1 items-center justify-center gap-2">
                        {#each planner.characters as char, i (char.id)}
                            <div class="flex flex-col items-center gap-1">
                                <span
                                    class="text-center text-[10px] font-bold leading-tight"
                                    style="color: {planner.getTrackColor(char.id, i).border};"
                                    >{char.name}</span
                                >
                                <CharacterSelect
                                    character={char}
                                    index={i}
                                    openTrigger={openCharTrigger}
                                />
                                <span
                                    class="text-[11px] font-medium"
                                    style="color: {planner.theme.textSecondary};"
                                    >{planner.getCharacterBlocks(char.id).length}</span
                                >
                            </div>
                            {#if i < planner.characters.length - 1}
                                <div class="text-lg font-bold text-zinc-400">→</div>
                            {/if}
                        {/each}
                    </div>
                    {#if lastSaveTime}
                        <div
                            class="absolute bottom-1 right-2 text-[9px]"
                            style="color: {planner.theme.mutedText};"
                        >
                            上次保存 {lastSaveTime}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    {#if showDescription}
        <div
            class="fixed inset-0 z-50 flex items-center justify-center"
            style="background: {planner.theme.overlayBackdrop};"
        >
            <div
                class="flex w-[92vw] max-w-6xl h-[90vh] flex-col rounded-xl shadow-2xl"
                style="border: 1px solid {planner.theme.modalBorder}; background: {planner.theme
                    .modalBg};"
            >
                <div
                    class="flex items-center justify-between px-5 py-3 shrink-0"
                    style="border-bottom: 1px solid {planner.theme.border};"
                >
                    <div class="flex items-center gap-3">
                        <span class="text-sm font-bold" style="color: {planner.theme.text};"
                            >工程总览</span
                        >
                        <span class="text-xs" style="color: {planner.theme.mutedText};"
                            >{planner.title}</span
                        >
                    </div>
                    <button
                        class="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors"
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
                        onclick={() => (showDescription = false)}>✕</button
                    >
                </div>
                <div class="flex flex-1 flex-col min-h-0 overflow-y-auto scrollbar-dark-thick">
                    <div class="shrink-0 pt-4 pb-3 px-5">
                        <div class="flex items-center gap-2 mb-3">
                            <span
                                class="text-xs font-semibold"
                                style="color: {planner.theme.textSecondary};">排轴总览</span
                            >
                            <div
                                class="h-px flex-1"
                                style="background: {planner.theme.divider};"
                            ></div>
                        </div>
                        <WrappedTimeline />
                    </div>
                    <div
                        class="shrink-0"
                        style="border-top: 1px solid {planner.theme.divider};"
                    ></div>
                    <div class="shrink-0 pt-3 pb-4 px-5">
                        <div class="flex items-center gap-2 mb-2">
                            <span
                                class="text-xs font-semibold"
                                style="color: {planner.theme.textSecondary};">文字轴</span
                            >
                            <div
                                class="h-px flex-1"
                                style="background: {planner.theme.divider};"
                            ></div>
                        </div>
                        <RotationDescription fillHeight={false} />
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <AlertDialog />

    <Modal open={themeManagerOpen} title="主题管理" onclose={() => (themeManagerOpen = false)}>
        <ThemeManager onclose={() => (themeManagerOpen = false)} />
    </Modal>
</div>
