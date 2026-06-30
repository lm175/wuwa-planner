export type KeyType =
    | 'LMB'
    | 'RMB'
    | 'Q'
    | 'E'
    | 'R'
    | 'T'
    | 'F'
    | 'Z'
    | 'X'
    | 'V'
    | 'intro'
    | 'jump'

export type KeyMode =
    | 'click'
    | 'hold'
    | 'preinput_swap'
    | 'preinput_action'
    | 'rapid_click'

export interface KeyOperation {
    key: KeyType
    mode: KeyMode
    comboStart?: number
    comboEnd?: number
    strong?: boolean
    comment?: string
}

export interface IconTextPair {
    icon: string
    text: string
}

export interface ActionBlock {
    id: string
    characterId: string
    label: string
    x: number
    isIntro: boolean
    introOverride: boolean | null
    keyOps: KeyOperation[]
    customIcons: IconTextPair[]
}
