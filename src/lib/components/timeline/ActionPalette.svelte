<script lang="ts">
    import type { KeyType, KeyMode, Theme } from '$lib/types'
    import KeyIcon from './KeyIcon.svelte'
    import StrongBadge from './StrongBadge.svelte'

    let {
        theme,
        selectedKey = $bindable('Q'),
        selectedMode = $bindable('click'),
        comboA = $bindable(0),
        comboB = $bindable(0),
        strong = $bindable(false),
        comment = $bindable(''),
    }: {
        theme: Theme
        selectedKey?: KeyType
        selectedMode?: KeyMode
        comboA?: number
        comboB?: number
        strong?: boolean
        comment?: string
    } = $props()

    function setComboA(v: number) {
        if (v <= 0) {
            comboA = 0
            comboB = 0
        } else {
            comboA = v
            if (comboB < v) comboB = v
        }
        if (comboA > 9) {
            resetCombo()
        }
    }

    function setComboB(v: number) {
        if (v <= 0) {
            comboA = 0
            comboB = 0
        } else {
            comboB = v
            if (comboA > v) comboA = v
        }
        if (comboB > 9) {
            resetCombo()
        }
    }

    function resetCombo() {
        comboA = 0
        comboB = 0
    }

    $effect(() => {
        void selectedKey
        void selectedMode
        resetCombo()
        comment = ''
        strong = false
    })

    const keyTypes: { key: KeyType; title: string; desc: string }[] = [
        { key: 'LMB', title: '左键', desc: '普攻 / 重击' },
        { key: 'RMB', title: '右键', desc: '闪避' },
        { key: 'Q', title: 'Q', desc: '声骸技能' },
        { key: 'E', title: 'E', desc: '共鸣技能' },
        { key: 'R', title: 'R', desc: '共鸣解放' },
        { key: 'T', title: 'T', desc: '探索工具' },
        { key: 'F', title: '处决', desc: '谐度破环' },
        { key: 'X', title: '下落', desc: '下落攻击' },
        { key: 'jump', title: '跳', desc: '跳跃' },
        { key: 'V', title: '', desc: '空操作' },
    ]

    const modes: { key: KeyMode; title: string; desc: string }[] = [
        { key: 'click', title: '点按', desc: '按下即放' },
        { key: 'hold', title: '长按', desc: '按住持续' },
        { key: 'preinput_swap', title: '预↔', desc: '切人前预输入' },
        { key: 'preinput_action', title: '预→', desc: '动作间预输入' },
        { key: 'rapid_click', title: '连击', desc: '狂按' },
    ]

    function startDrag(e: DragEvent) {
        const data = JSON.stringify({
            key: selectedKey,
            mode: selectedMode,
            comboA,
            comboB,
            strong,
            comment,
        })
        e.dataTransfer?.setData('application/wuwa-keyop', data)
        e.dataTransfer!.effectAllowed = 'copy'
    }
</script>

<div
    class="action-palette flex flex-col rounded-lg p-2 sm:p-3 h-auto md:h-full overflow-x-auto min-w-[320px] sm:min-w-0"
    style="border: 1px solid {theme.border}; background: {theme.panelBg};"
>
    <div class="mb-1.5 flex items-center justify-between shrink-0">
        <h3
            class="text-xs sm:text-sm font-bold uppercase tracking-wider"
            style="color: {theme.textSecondary};"
        >
            操作面板
        </h3>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="flex cursor-grab items-center gap-0.5 rounded border border-dashed px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium transition-colors active:cursor-grabbing"
            style="border-color: {theme.border}; color: {theme.textSecondary};"
            onmouseenter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = theme.text
                ;(e.currentTarget as HTMLElement).style.color = theme.text
            }}
            onmouseleave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor = theme.border
                ;(e.currentTarget as HTMLElement).style.color = theme.textSecondary
            }}
            draggable="true"
            ondragstart={startDrag}
        >
            <span style="color: {theme.textSecondary};">⠿</span>
            <span class="hidden sm:inline">拖动入轴</span>
        </div>
    </div>

    <div class="flex flex-1 flex-col gap-1 sm:gap-2 min-h-0">
        <div class="key-section shrink-0 md:flex-1 md:min-h-0">
            <span
                class="mb-1.5 block text-[11px] sm:text-xs font-semibold"
                style="color: {theme.textSecondary};">按键</span
            >
            <div class="grid grid-cols-5 gap-1.5 sm:gap-2">
                {#each keyTypes as kt}
                    <button
                        class={'flex items-stretch gap-1.5 rounded px-1.5 py-1.5 sm:py-2 transition-colors ' +
                            (selectedKey === kt.key ? 'ring-2 ring-offset-1' : '')}
                        style="
							border: 1px solid {theme.nodeColors[kt.key] ?? theme.fallbackTrack}40;
							background: {selectedKey === kt.key
                            ? (theme.nodeColors[kt.key] ?? theme.fallbackTrack) + '20'
                            : 'transparent'};
							color: {theme.text};
							ring-color: {theme.nodeColors[kt.key] ?? theme.fallbackTrack}80;
							--tw-ring-offset-color: {theme.ringOffset};
						"
                        onclick={() => (selectedKey = kt.key)}
                    >
                        <div class="flex items-center justify-center shrink-0 aspect-square">
                            <KeyIcon
                                key={kt.key}
                                size="md"
                                color={theme.nodeColors[kt.key]}
                                mode={selectedKey === 'LMB' ? selectedMode : undefined}
                            />
                        </div>
                        <span
                            class="hidden sm:flex items-center font-bold text-[10px] sm:text-xs leading-tight"
                            style="color: {theme.textSecondary};">{kt.desc}</span
                        >
                    </button>
                {/each}
            </div>
        </div>

        <div class="shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div class="flex-3 min-w-0">
                <span
                    class="mb-1.5 block text-xs font-semibold"
                    style="color: {theme.textSecondary};">连段</span
                >
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                        class="text-[11px] font-medium shrink-0"
                        style="color: {theme.textSecondary};">从第</span
                    >
                    <button
                        class="flex h-6 w-6 items-center justify-center rounded border text-xs font-bold shrink-0"
                        style="border-color: {theme.border}; color: {theme.textSecondary};"
                        onclick={() => setComboA(Math.max(0, comboA - 1))}>−</button
                    >
                    <div
                        class="flex h-6 items-center justify-center rounded border text-xs font-bold shrink-0"
                        style="border-color: {theme.accentText}; color: {theme.accentText}; background: {theme.selectedModeBg}; min-width: 24px; padding: 0 5px;"
                    >
                        {comboA}
                    </div>
                    <button
                        class="flex h-6 w-6 items-center justify-center rounded border text-xs font-bold shrink-0"
                        style="border-color: {theme.border}; color: {theme.textSecondary};"
                        onclick={() => setComboA(comboA + 1)}>+</button
                    >
                    <span
                        class="text-[11px] font-medium shrink-0"
                        style="color: {theme.textSecondary};">段至第</span
                    >
                    <button
                        class="flex h-6 w-6 items-center justify-center rounded border text-xs font-bold shrink-0"
                        style="border-color: {theme.border}; color: {theme.textSecondary};"
                        onclick={() => setComboB(comboB - 1)}>−</button
                    >
                    <div
                        class="flex h-6 items-center justify-center rounded border text-xs font-bold shrink-0"
                        style="border-color: {theme.accentText}; color: {theme.accentText}; background: {theme.selectedModeBg}; min-width: 24px; padding: 0 5px;"
                    >
                        {comboB}
                    </div>
                    <button
                        class="flex h-6 w-6 items-center justify-center rounded border text-xs font-bold shrink-0"
                        style="border-color: {theme.border}; color: {theme.textSecondary};"
                        onclick={() => setComboB(comboB + 1)}>+</button
                    >
                    <span
                        class="text-[11px] font-medium shrink-0"
                        style="color: {theme.textSecondary};">段</span
                    >
                    <button
                        class="rounded border px-2.5 py-1 text-[11px] font-medium shrink-0 transition-colors"
                        style="border-color: {theme.border}; color: {theme.mutedText};"
                        onmouseenter={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = theme.buttonHover
                        }}
                        onmouseleave={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = ''
                        }}
                        onclick={resetCombo}>重置连段</button
                    >
                </div>
            </div>

            <div class="flex-2 min-w-0">
                <span
                    class="mb-1.5 block text-xs font-semibold"
                    style="color: {theme.textSecondary};">特殊</span
                >
                <div class="flex items-center gap-2 flex-wrap">
                    <button
                        class="flex h-7 w-7 items-center justify-center rounded border text-xs font-bold transition-colors"
                        style="border-color: {strong
                            ? theme.accentText
                            : theme.border}; background: {strong
                            ? theme.selectedModeBg
                            : 'transparent'}; color: {strong
                            ? theme.accentText
                            : theme.textSecondary};"
                        onclick={() => (strong = !strong)}
                        title="强化"
                    >
                        <StrongBadge size={16} />
                    </button>
                    <div class="flex items-center gap-1 flex-1 min-w-20">
                        <input
                            type="text"
                            class="flex-1 rounded border bg-transparent px-2 py-1 text-xs font-medium outline-none"
                            style="border-color: {theme.border}; color: {theme.text};"
                            placeholder="备注"
                            value={comment}
                            oninput={(e) => {
                                const v = (e.target as HTMLInputElement).value.replace(/\s/g, '')
                                comment = v
                                ;(e.target as HTMLInputElement).value = v
                            }}
                        />
                        <button
                            class="rounded border px-1.5 py-1 text-[10px] font-medium shrink-0 transition-colors"
                            style="border-color: {theme.border}; color: {theme.mutedText};"
                            onmouseenter={(e) => {
                                ;(e.currentTarget as HTMLElement).style.background =
                                    theme.buttonHover
                            }}
                            onmouseleave={(e) => {
                                ;(e.currentTarget as HTMLElement).style.background = ''
                            }}
                            onclick={() => (comment = '')}
                            title="清除备注">清空</button
                        >
                    </div>
                </div>
            </div>
        </div>

        <div class="shrink-0">
            <span
                class="mb-1.5 block text-[11px] sm:text-xs font-semibold"
                style="color: {theme.textSecondary};">模式</span
            >
            <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {#each modes as m}
                    <button
                        class={'flex flex-col items-center justify-center gap-0.5 rounded px-2 py-1.5 sm:py-2 text-[11px] sm:text-sm transition-colors ' +
                            (selectedMode === m.key ? '' : '')}
                        style="border: 1px solid {selectedMode === m.key
                            ? theme.accentText
                            : theme.border}; color: {theme.text}; background: {selectedMode ===
                        m.key
                            ? theme.selectedModeBg
                            : 'transparent'}; {selectedMode === m.key
                            ? `box-shadow: 0 0 0 1px ${theme.selectedModeRing};`
                            : ''}"
                        onclick={() => (selectedMode = m.key)}
                    >
                        <span class="font-bold leading-tight text-center">{m.title}</span>
                        <span
                            class="hidden sm:block text-[10px] sm:text-xs font-medium leading-tight text-center"
                            style="color: {theme.textSecondary};">{m.desc}</span
                        >
                    </button>
                {/each}
            </div>
        </div>
    </div>
</div>
