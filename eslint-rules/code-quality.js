const TRACKING_REFERENCES = [
  { pattern: /\bEUDPA-\d+/, label: 'a ticket key' },
  { pattern: /\b(?:c|d|q|inc|req)-\d{3}\b/, label: 'a backlog or ruling id' },
  { pattern: /\bDesign Release\b/i, label: 'a release name' },
  { pattern: /\bDR2\.?1\b/, label: 'a release name' },
  { pattern: /\bRuled\b/, label: 'a ruling reference' },
  { pattern: /\bthe real service\b/i, label: 'session vocabulary' }
]

const TEST_FUNCTION_NAMES = new Set(['describe', 'it', 'test', 'suite'])

const LOGGED_LEVELS = new Set(['error', 'warn'])

const findTrackingReference = (text) =>
  TRACKING_REFERENCES.find(({ pattern }) => pattern.test(text))

const rootCalleeName = (callee) => {
  let node = callee
  while (node) {
    if (node.type === 'Identifier') {
      return node.name
    }
    if (node.type === 'MemberExpression') {
      node = node.object
    } else if (node.type === 'CallExpression') {
      node = node.callee
    } else {
      return undefined
    }
  }
  return undefined
}

const isTestFunctionCall = (node) =>
  TEST_FUNCTION_NAMES.has(rootCalleeName(node.callee))

const literalText = (node) => {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (node?.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.cooked).join('')
  }
  return undefined
}

const noTrackingReferences = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow ticket keys, backlog or ruling ids, release names and session vocabulary in comments and test titles'
    },
    schema: [],
    messages: {
      inComment:
        'Comment contains {{label}} ("{{match}}"). Say what the code does instead.',
      inTestTitle:
        'Test title contains {{label}} ("{{match}}"). State what the assertions prove instead.'
    }
  },
  create(context) {
    const reportIfTracked = (node, text, messageId) => {
      const reference = findTrackingReference(text)
      if (reference) {
        context.report({
          node,
          messageId,
          data: {
            label: reference.label,
            match: text.match(reference.pattern)[0]
          }
        })
      }
    }

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          reportIfTracked(comment, comment.value, 'inComment')
        }
      },
      CallExpression(node) {
        if (!isTestFunctionCall(node)) {
          return
        }
        const title = literalText(node.arguments[0])
        if (title !== undefined) {
          reportIfTracked(node.arguments[0], title, 'inTestTitle')
        }
      }
    }
  }
}

const isCatchCall = ({ callee }) =>
  callee.type === 'MemberExpression' &&
  callee.property.type === 'Identifier' &&
  callee.property.name === 'catch'

const FUNCTION_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression'
])

const isSilentHandler = (handler) => {
  if (!FUNCTION_TYPES.has(handler?.type) || handler.params.length) {
    return false
  }
  const { body } = handler
  if (body.type === 'BlockStatement') {
    return body.body.length === 0
  }
  return body.type === 'Identifier' && body.name === 'undefined'
}

const noSilentCatch = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow .catch(() => undefined) and .catch(() => {}), which drop the error without a trace'
    },
    schema: [],
    messages: {
      silent:
        'This .catch drops the error. Log it with { err } and the ids support searches by, or let it reject.'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isCatchCall(node) && isSilentHandler(node.arguments[0])) {
          context.report({ node, messageId: 'silent' })
        }
      }
    }
  }
}

const memberPath = (node) => {
  if (node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'ThisExpression') {
    return 'this'
  }
  if (node.type === 'MemberExpression') {
    const property =
      node.property.type === 'Identifier' ? node.property.name : ''
    return `${memberPath(node.object)}.${property}`
  }
  return ''
}

const isLoggerCall = ({ callee }) =>
  callee.type === 'MemberExpression' &&
  callee.property.type === 'Identifier' &&
  LOGGED_LEVELS.has(callee.property.name) &&
  /log/i.test(memberPath(callee.object))

const isStringOnly = (args) =>
  args.length > 0 && args.every((arg) => literalText(arg) !== undefined)

const isCatchHandler = (node) =>
  FUNCTION_TYPES.has(node.type) &&
  node.parent?.type === 'CallExpression' &&
  node.parent.arguments[0] === node &&
  isCatchCall(node.parent)

const caughtErrorName = (ancestor) => {
  if (ancestor.type === 'CatchClause') {
    return ancestor.param?.type === 'Identifier'
      ? ancestor.param.name
      : undefined
  }
  if (isCatchHandler(ancestor) && ancestor.params[0]?.type === 'Identifier') {
    return ancestor.params[0].name
  }
  return undefined
}

const innermostCaughtErrorName = (ancestors) =>
  ancestors.map(caughtErrorName).findLast((name) => name !== undefined)

const noMessageOnlyErrorLog = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow logger.error or logger.warn with only a string when a caught error is in scope'
    },
    schema: [],
    messages: {
      stringOnly:
        'Log the caught error as { err: {{name}} } with the ids support searches by, not only a message.'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isLoggerCall(node) || !isStringOnly(node.arguments)) {
          return
        }
        const name = innermostCaughtErrorName(
          context.sourceCode.getAncestors(node)
        )
        if (name) {
          context.report({ node, messageId: 'stringOnly', data: { name } })
        }
      }
    }
  }
}

export const codeQuality = {
  meta: { name: 'code-quality' },
  rules: {
    'no-tracking-references': noTrackingReferences,
    'no-silent-catch': noSilentCatch,
    'no-message-only-error-log': noMessageOnlyErrorLog
  }
}
