// Keys are case-sensitive — 'complete' (fileStatus) and 'COMPLETE' (scanStatus) map to different labels.
// PENDING is included explicitly so all known scanStatus values are documented here,
// even though the generic transform would produce the same result.
const LABEL_OVERRIDES = Object.freeze({
  // reasonForImport
  reEntry: 'Re-entry',

  // scanStatus
  COMPLETE: 'Safe',
  REJECTED: 'Virus found',
  PENDING: 'Pending',

  // fileStatus
  complete: 'Uploaded',
  rejected: 'Rejected',

  // certifiedFor — generic produces "Breeding and or production" without the slash
  breedingAndOrProduction: 'Breeding and/or production'
})

const sentenceCase = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

const genericTransform = (value) =>
  /^[A-Z][A-Z0-9_]*$/.test(value)
    ? sentenceCase(value.split('_').join(' '))
    : sentenceCase(value.split(/(?=[A-Z])/).join(' '))

export const label = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const str = String(value)
  if (Object.prototype.hasOwnProperty.call(LABEL_OVERRIDES, str)) {
    return LABEL_OVERRIDES[str]
  }
  return genericTransform(str)
}
