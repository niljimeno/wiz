let variables = { __proto__: null }
let currentScope = { __proto__: null }

function tokenize(code) {
  return [...code.matchAll(/"(?:\\.|[^"\\])*"|;[^\r\n]*|[()[\]{},]|[^\s()[\]{},;]+/g)]
    .map(match => match[0])
    .filter(token => !token.startsWith(";"))
}

function parse(tokens) {
  let index = 0

  function parse_read() {
    let token = tokens[index++]

    function parse_list(closing, list = []) {
      while (tokens[index] !== closing) {
        if (tokens[index] === undefined)
          throw Error("Unclosed " + token)
        list.push(parse_read())
      }

      index++
      return list
    }

    if (token == "(")
      return parse_list(")")

    if (token == "[")
      return parse_list("]", ["list"])

    if (token == "{")
      return parse_list("}", ["struct"])

    if (token == ",")
      return [",", parse_read()]

    if (token.startsWith('"') && (token.length == 1 || token.at(-1) != '"'))
      throw Error('Unclosed "')

    return token
  }

  let expressions = []
  while (index < tokens.length)
    expressions.push(parse_read())

  return expressions
}

function checkTruth(el) {
  return !(el === false || el === undefined || el === null)
}

const basicFunctions = {
  __proto__: null,
  print: console.log,
  string: (...values) => values.join(" "),
  list: (...values) => values,
  struct: (...values) => Object.fromEntries(
    Array.from({ length: values.length / 2 }, (_, index) =>
      values.slice(index * 2, index * 2 + 2))),
  "+": (...values) => values.reduce((sum, value) => sum + value),
  "-": (value, ...values) =>
    values.length ? values.reduce((result, value) => result - value, value) : -value,
  "*": (...values) => values.reduce((sum, value) => sum * value),
  "/": (value, ...values) =>
    values.length ? values.reduce((result, value) => result / value, value) : 1 / value,
  "%": (...values) => values.reduce((sum, value) => sum % value),
  "not": (value) => !checkTruth(value),
  "=": (...values) => values.slice(1).every(value => value === values[0]),
  "==": (...values) => values.slice(1).every(value => value == values[0]),
  "<": (...values) => values.slice(1).every((value, i) => value > values[i]),
  ">": (...values) => values.slice(1).every((value, i) => value < values[i]),
  "<=": (...values) => values.slice(1).every((value, i) => value >= values[i]),
  ">=": (...values) => values.slice(1).every((value, i) => value <= values[i]),
  map: (fun, list) => Array.from(list).map(value => fun(value)),
  reduce: (fun, list) => Array.from(list).reduce((result, value) => fun(result, value)),
  all: (...values) => values.every(value => checkTruth(value)),
  any: (...values) => values.some(value => checkTruth(value)),
  head: list => list[0],
  tail: list => list.slice(1),
  init: list => list.slice(0, -1),
  last: list => list.at(-1),
  reverse: list => Array.from(list).reverse(),
  repeat: (count, value) => Array(count).fill(value),
  take: (count, list) => list.slice(0, count),
  concat: (...lists) => lists.flat(),
  append: (list, ...values) => [...list, ...values],
  get: (struct, key) => struct[key],
  set: (struct, key, value) => ({ ...struct, [key]: value }),

  httpReq: (type, { url, method = "GET", headers = {}, body }) => async () => {
    headers = Object.fromEntries(Object.entries(headers).map(([key, value]) =>
      [key.toLowerCase().replace(/(^|-)\w/g, part => part.toUpperCase()), value]))

    if (body != undefined) {
      if (headers["Content-Type"] == undefined)
        headers["Content-Type"] = "application/json"

      if (headers["Content-Type"].toLowerCase() == "application/json") {
        body = JSON.stringify(body)
      }
    }

    try {
      let response = await fetch(url, { method, headers, body })
      let contentType = response.headers.get("Content-Type") || ""
      let value = contentType.includes("application/json")
        ? await response.json()
        : await response.text()
      return { type, status: response.status, value }
    } catch (error) {
      return { type, status: false, value: error.message }
    }
  },
}

const baseFunctions = {
  __proto__: null,

  def: (name, value) => currentScope[name] = execute(value),

  do: (...expressions) => expressions.map(execute).at(-1),

  if: (condition, then, otherwise) =>
    checkTruth(execute(condition)) ? execute(then) :
      otherwise === undefined ? undefined : execute(otherwise),

  case: (value, ...pairs) => {
    value = execute(value)
    for (let index = 0; index + 1 < pairs.length; index += 2)
      if (value === execute(pairs[index]))
        return execute(pairs[index + 1])
    return pairs.length % 2 ? execute(pairs.at(-1)) : undefined
  },

  and: (...expressions) => {
    let value = true
    for (let expression of expressions) {
      value = execute(expression)
      if (!checkTruth(value))
        return value
    }
    return value
  },

  or: (...expressions) => {
    let value = false
    for (let expression of expressions) {
      value = execute(expression)
      if (checkTruth(value))
        return value
    }
    return value
  },

  "->": (value, ...expressions) => expressions.reduce((value, expression) => {
    let [name, ...args] = Array.isArray(expression) ? expression : [expression]
    return execute(name)(value, ...args.map(execute))
  }, execute(value)),

  "->>": (value, ...expressions) => expressions.reduce((value, expression) => {
    let [name, ...args] = Array.isArray(expression) ? expression : [expression]
    return execute(name)(...args.map(execute), value)
  }, execute(value)),

  defn: (name, parameters, ...body) =>
    currentScope[name] = baseFunctions.lambda(parameters, ["do", ...body]),

  lambda: (parameters, body) => {
    let parentScope = currentScope
    parameters = parameters.slice(1)

    return (...values) => {
      let localScope = Object.create(parentScope)
      parameters.forEach((name, index) => localScope[name] = values[index])
      return executeInScope(body, localScope)
    }
  },

  partial: (fn, ...initialArgs) => {
    fn = execute(fn)
    initialArgs = initialArgs.map(execute)
    return (...args) => fn(...initialArgs, ...args)
  },

  let: (bindings, ...body) => {
    let localScope = Object.create(currentScope)
    for (let index = 1; index < bindings.length; index += 2)
      localScope[bindings[index]] = execute(bindings[index + 1])
    return executeInScope(["do", ...body], localScope)
  },

  html: expression => render(execute(expression))
}

function render([tag, ...children]) {
  let attributesArgument = children[0]?.constructor == Object
    ? children.shift()
    : {}

  let attributes = Object.entries(attributesArgument)
    .map(([key, value]) => " " + key + '="' + escapeHTML(value) + '"')
    .join("")

  let content = children
    .map(value => !checkTruth(value) ? "" :
      Array.isArray(value) ? render(value) : escapeHTML(value))
    .join("")

  return "<" + tag + attributes + ">" + content + "</" + tag + ">"
}

function escapeHTML(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

const htmlTags = [
  "a", "article", "aside", "button", "code", "div", "em", "fieldset",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "img",
  "input", "label", "legend", "li", "main", "nav", "ol", "option", "p", "pre",
  "section", "select", "small", "span", "strong", "table", "tbody", "td",
  "textarea", "th", "thead", "tr", "ul",
]

function executeInScope(expression, scope) {
  let previousScope = currentScope
  currentScope = scope

  try {
    return execute(expression)
  } finally {
    currentScope = previousScope
  }
}

function toVariable(token) {
  switch (true) {
    case token.startsWith('"'):
      return token.slice(1, -1).replace(/\\(.)/g, "$1")

    case /^-?\d+(\.\d+)?$/.test(token):
      return Number(token)

    case token.startsWith(":"):
      return token.slice(1)

    case basicFunctions[token] != undefined:
      return basicFunctions[token]

    case token == "true":
      return true

    case token == "false":
      return false

    case currentScope[token] != undefined:
      return currentScope[token]

    case htmlTags.includes(token):
      return (...children) => [token, ...children]

    default:
      return undefined
  }
}

function execute(expression) {
  if (!Array.isArray(expression))
    return toVariable(expression)

  let [name, ...args] = expression

  if (baseFunctions[name])
    return baseFunctions[name](...args)

  let value = execute(name)
  args = args.flatMap(arg =>
    Array.isArray(arg) && arg[0] == "," ? execute(arg[1]) : [execute(arg)])

  if (typeof value == "function")
    return value(...args)

  return value[args[0]]
}

let model
let calls

function dispatch(action) {
  model = currentScope.update(model, action)
  draw()
}

function draw() {
  calls = new Map()
  let view = currentScope.view(model)

  function bind(value) {
    if (!Array.isArray(value))
      return

    let handler = value[1]?.["on-click"]
    if (handler) {
      let id = calls.size
      calls.set(String(id), async () =>
        dispatch(await (typeof handler == "function" ? handler() : handler)))
      value[1]["on-click"] = id
    }

    value.forEach(bind)
  }

  bind(view)
  document.body.innerHTML = render(view)
}

document.body.onclick = event =>
  calls.get(event.target.getAttribute("on-click"))?.()

parse(tokenize(code)).forEach(execute)
model = currentScope.init
draw()
