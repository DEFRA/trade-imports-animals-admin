// Keys are case-sensitive — 'complete' (fileStatus) and 'COMPLETE' (scanStatus) map to different labels.
// PENDING is included explicitly so all known scanStatus values are documented here,
// even though the generic transform would produce the same result.
const LABEL_OVERRIDES = {
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
}

function sentenceCase(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function genericTransform(value) {
  if (/^[A-Z][A-Z0-9_]*$/.test(value)) {
    return sentenceCase(value.split('_').join(' '))
  }
  return sentenceCase(value.split(/(?=[A-Z])/).join(' '))
}

export function label(value) {
  if (value === null || value === undefined || value === '') return ''
  const str = String(value)
  if (Object.prototype.hasOwnProperty.call(LABEL_OVERRIDES, str)) {
    return LABEL_OVERRIDES[str]
  }
  return genericTransform(str)
}
