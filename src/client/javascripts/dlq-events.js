const deleteAllBtn = document.getElementById('delete-all-btn')
const replayAllBtn = document.getElementById('replay-all-btn')
const dialog = document.getElementById('delete-all-dialog')
const confirmBtn = document.getElementById('confirm-delete-all-btn')
const cancelBtn = document.getElementById('cancel-delete-all-btn')
const actionInput = document.getElementById('dlq-action-input')
const form = document.getElementById('dlq-action-form')

let dialogOpener = null

if (replayAllBtn && actionInput && form) {
  replayAllBtn.addEventListener('click', () => {
    actionInput.value = 'replay-all'
    form.submit()
  })
}

if (deleteAllBtn && dialog && confirmBtn && cancelBtn && actionInput && form) {
  deleteAllBtn.addEventListener('click', () => {
    dialogOpener = deleteAllBtn
    dialog.showModal()
  })

  cancelBtn.addEventListener('click', () => {
    dialog.close()
  })

  confirmBtn.addEventListener('click', () => {
    actionInput.value = 'delete-all'
    dialog.close()
    form.submit()
  })

  dialog.addEventListener('close', () => {
    if (dialogOpener) {
      dialogOpener.focus()
      dialogOpener = null
    }
  })
}
