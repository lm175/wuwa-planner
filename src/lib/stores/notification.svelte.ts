interface NotificationState {
    visible: boolean
    message: string
}

function createNotificationStore() {
    let state = $state<NotificationState>({
        visible: false,
        message: '',
    })
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    function show(message: string, duration = 3000) {
        if (timeoutId) clearTimeout(timeoutId)
        state = { visible: true, message }
        timeoutId = setTimeout(() => {
            state = { visible: false, message: '' }
            timeoutId = null
        }, duration)
    }

    function hide() {
        if (timeoutId) clearTimeout(timeoutId)
        state = { visible: false, message: '' }
        timeoutId = null
    }

    return {
        get state() {
            return state
        },
        show,
        hide,
    }
}

export const notification = createNotificationStore()
