/**
 * Toast helpers - thin wrapper over `sonner` (rendered by <Toaster> in App.jsx).
 *
 * Mirrors the merchant dashboard's toast API (showSuccessToast / showErrorToast)
 * so components ported across apps - e.g. CloudinaryImageUploader and the
 * merchant product page - work without edits.
 */
import { toast } from 'sonner'

export const showSuccessToast = (message) => toast.success(message)

export const showErrorToast = (message) => toast.error(message)
