const selectAll = document.getElementById('select-all')
const deleteBtn = document.getElementById('delete-btn')
const dialog = document.getElementById('delete-dialog')
const referenceList = document.getElementById('dialog-reference-list')
const confirmBtn = document.getElementById('confirm-delete-btn')
const cancelBtn = document.getElementById('cancel-delete-btn')
const successBanner = document.getElementById('success-banner')
const errorBanner = document.getElementById('error-banner')

let selectedRefs = []
const REDIRECT_DELAY_MS = 3000
let dialogOpener = null

// Shared dialog guard — wires confirm/cancel regardless of whether the table is present
if (dialog && confirmBtn && cancelBtn && successBanner && errorBanner) {
  cancelBtn.addEventListener('click', () => {
    dialog.close()
  })

  confirmBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRefs)
      })

      if (response.ok) {
        dialog.close()
        selectedRefs = []
        successBanner.hidden = false
        setTimeout(() => {
          window.location.href = '/notifications'
        }, REDIRECT_DELAY_MS)
      } else {
        dialog.close()
        selectedRefs = []
        successBanner.hidden = true
        errorBanner.hidden = false
      }
    } catch {
      dialog.close()
      selectedRefs = []
      successBanner.hidden = true
      errorBanner.hidden = false
    }
  })

  dialog.addEventListener('close', () => {
    if (dialogOpener) {
      dialogOpener.focus()
      dialogOpener = null
    }
  })
}

// Bulk delete guard — only active when the notifications table is rendered
if (selectAll && deleteBtn && dialog) {
  const checkboxes = document.querySelectorAll('.notification-checkbox')
  const deleteError = document.getElementById('delete-error')

  selectAll.addEventListener('change', () => {
    checkboxes.forEach((cb) => {
      cb.checked = selectAll.checked
    })
  })

  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const checkedCount = [...checkboxes].filter((c) => c.checked).length
      selectAll.checked = checkedCount === checkboxes.length
      selectAll.indeterminate =
        checkedCount > 0 && checkedCount < checkboxes.length
    })
  })

  deleteBtn.addEventListener('click', () => {
    const anyChecked = [...checkboxes].some((cb) => cb.checked)

    if (!anyChecked) {
      deleteError.hidden = false
      return
    }

    deleteError.hidden = true

    selectedRefs = [...checkboxes]
      .filter((cb) => cb.checked)
      .map((cb) => cb.value)

    errorBanner.hidden = true

    referenceList.innerHTML = ''
    selectedRefs.forEach((ref) => {
      const li = document.createElement('li')
      li.textContent = ref
      referenceList.appendChild(li)
    })

    dialogOpener = deleteBtn
    dialog.showModal()
  })
}

// Manual delete guard — always active; allows delete by typed reference number
const manualInput = document.getElementById('manual-reference-input')
const manualDeleteBtn = document.getElementById('manual-delete-btn')

if (manualInput && manualDeleteBtn && dialog && referenceList && errorBanner) {
  manualDeleteBtn.addEventListener('click', () => {
    const ref = manualInput.value.trim()
    if (!ref) return

    selectedRefs = [ref]
    errorBanner.hidden = true

    referenceList.innerHTML = ''
    const li = document.createElement('li')
    li.textContent = ref
    referenceList.appendChild(li)

    dialogOpener = manualDeleteBtn
    dialog.showModal()
  })
}
