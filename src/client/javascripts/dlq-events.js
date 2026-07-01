const selectAll = document.getElementById('select-all')

// Select-all toggle for the DLQ table. Replay/delete themselves are a server-side
// form POST, so this is the only client behaviour the page needs.
if (selectAll) {
  const checkboxes = document.querySelectorAll('.dlq-checkbox')

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
}
