import toast from 'react-hot-toast'

export const showSuccessToast = (message) => {
  return toast.success(message, {
    duration: 4000,
    position: 'top-right',
  })
}

export const showErrorToast = (message) => {
  return toast.error(message, {
    duration: 5000,
    position: 'top-right',
  })
}

export const showLoadingToast = (message) => {
  return toast.loading(message, {
    position: 'top-right',
  })
}

export const dismissToast = (toastId) => {
  toast.dismiss(toastId)
}

export const showInfoToast = (message) => {
  return toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: 'ℹ️',
  })
}

export const showWarningToast = (message) => {
  return toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: '⚠️',
    style: {
      background: '#fbbf24',
      color: '#78350f',
    },
  })
}
