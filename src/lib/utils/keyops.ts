import type { KeyOperation } from '$lib/types'

export function showModeLabel(op: KeyOperation): boolean {
    if (op.key === 'LMB' && op.mode === 'hold') return false
    return op.mode !== 'click'
}
