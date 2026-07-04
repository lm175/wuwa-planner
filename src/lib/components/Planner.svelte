<script lang="ts">
    import { onMount } from 'svelte'
    import { planner } from '$lib/stores/planner.svelte'
    import { projects } from '$lib/stores/projects.svelte'
    import { themeStore } from '$lib/stores/themes.svelte'
    import { loadCharacterPresets } from '$lib/data/characters'
    import { isInputFocused } from '$lib/utils/planner'
    import Sidebar from './Sidebar.svelte'
    import AlertDialog from './ui/AlertDialog.svelte'
    import NotificationBar from './ui/NotificationBar.svelte'
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
    let mobileSidebarOpen = $state(false)
    let isMobile = $state(false)

    $effect(() => {
        const check = () => {
            isMobile = window.innerWidth < 768
            if (!isMobile) mobileSidebarOpen = false
        }
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    })
    let lastSaveTime = $state<string>('')
    let showDescription = $state(false)
    let themeOpen = $state(false)
    let themeManagerOpen = $state(false)
    let panelHeight = $state(260)
    let snappedAt280 = false
    let snappedAt160 = false
    let compactPalette = $derived(isMobile || panelHeight < 320)
    let superCompactPalette = $derived(!isMobile && panelHeight <= 160)
    let keySingleRow = $derived(!isMobile && panelHeight < 320)

    function startResize(e: PointerEvent) {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        const startY = e.clientY
        const startH = panelHeight
        const parent = (e.currentTarget as HTMLElement).parentElement!
        const maxH = parent.getBoundingClientRect().height - 80
        snappedAt280 = !isMobile && panelHeight >= 280
        snappedAt160 = !isMobile && panelHeight <= 160

        function onMove(ev: PointerEvent) {
            const delta = startY - ev.clientY
            const minH = superCompactPalette ? 8 : 140
            let h = Math.max(minH, Math.min(maxH, startH + delta))

            if (!isMobile) {
                const SNAP = 18
                if (!superCompactPalette) {
                    if (snappedAt280) {
                        if (h < 280 - SNAP || h > 280 + SNAP) snappedAt280 = false
                        else h = 280
                    } else if (h > 280 - SNAP && h < 280 + SNAP) {
                        snappedAt280 = true
                        h = 280
                    }
                }
                const SNAP_160 = 7
                if (snappedAt160) {
                    if (h < 160 - SNAP_160 || h > 160 + SNAP_160) snappedAt160 = false
                    else h = 160
                } else if (h > 160 - SNAP_160 && h < 160 + SNAP_160) {
                    snappedAt160 = true
                    h = 160
                }
            }

            panelHeight = h
        }
        function onUp() {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
        }
        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
    }

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

        return () => clearInterval(saveTimer)
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
    class="flex h-dvh overflow-y-auto md:overflow-hidden flex-col md:flex-row"
    style="font-family: {planner.theme.fontFamily};"
    oncontextmenu={(e) => e.preventDefault()}
>
    <div class="hidden md:block">
        <Sidebar
            collapsed={sidebarCollapsed}
            ontoggle={() => (sidebarCollapsed = !sidebarCollapsed)}
        />
    </div>

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
                onclick={() => {
                    if (isMobile) {
                        mobileSidebarOpen = !mobileSidebarOpen
                    } else {
                        sidebarCollapsed = !sidebarCollapsed
                    }
                }}>{isMobile ? '☰' : sidebarCollapsed ? '☰' : '✕'}</button
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
                    ><span class="hidden sm:inline"
                        >{themeStore.getTheme(themeStore.activeThemeId)?.name ?? '主题'}</span
                    ><span class="sm:hidden">主题</span></button
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
            <div class="flex-1 min-h-0 p-3 pb-0 overflow-hidden">
                <TimelineArea {selectedKey} {selectedMode} {comboA} {comboB} {strong} {comment} />
            </div>

            {#if !isMobile}
                <div
                    class="shrink-0 h-2 cursor-row-resize relative z-10 flex items-center justify-center transition-colors hover:bg-white/5"
                    style="background: {planner.theme.border};"
                    onpointerdown={startResize}
                    role="separator"
                >
                    <div
                        class="w-6 h-0.5 rounded-full"
                        style="background: {planner.theme.textSecondary}40;"
                    ></div>
                </div>
            {/if}

            <div
                class="flex gap-3 px-3 sm:px-4 py-3 sm:py-4 min-w-0 flex-col md:flex-row"
                style="border-top: 1px solid {planner.theme.border}; {isMobile
                    ? 'min-height: 180px'
                    : 'height: ' +
                      panelHeight +
                      'px' +
                      (compactPalette && !isMobile && !superCompactPalette
                          ? '; min-height: 280px'
                          : '')};"
            >
                <div class="min-w-0 flex-1">
                    <ActionPalette
                        theme={planner.theme}
                        bind:selectedKey
                        bind:selectedMode
                        bind:comboA
                        bind:comboB
                        bind:strong
                        bind:comment
                        compact={compactPalette}
                        superCompact={superCompactPalette}
                        {keySingleRow}
                    />
                </div>
                <div
                    class="relative flex min-w-0 flex-col rounded-lg px-3 sm:px-4 py-2 sm:py-3 overflow-y-auto scrollbar-none min-h-[80px] md:min-h-0"
                    class:hidden={superCompactPalette}
                    style="border: 1px solid {planner.theme.border}; background: {planner.theme
                        .panelBg};"
                >
                    <div class="mb-1 sm:mb-2 flex items-center justify-between">
                        <span
                            class="text-[10px] sm:text-[11px] font-bold"
                            style="color: {planner.theme.textSecondary};">队伍配置</span
                        >
                    </div>
                    <div class="flex flex-1 items-center justify-center gap-1 sm:gap-2">
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

    <div class="md:hidden">
        <Sidebar
            collapsed={!mobileSidebarOpen}
            ontoggle={() => (mobileSidebarOpen = !mobileSidebarOpen)}
            overlay={mobileSidebarOpen}
            onclose={() => (mobileSidebarOpen = false)}
        />
    </div>

    <AlertDialog />
    <NotificationBar />

    <Modal open={themeManagerOpen} title="主题管理" onclose={() => (themeManagerOpen = false)}>
        <ThemeManager onclose={() => (themeManagerOpen = false)} />
    </Modal>
</div>
