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
  string: (...values) => values.map(value => Array.isArray(value) ? value.join("") : value).join(" "),
  list: (...values) => values,
  length: list => list.length,
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
  "/=": (...values) => !values.slice(1).every(value => value === values[0]),
  "/==": (...values) => !values.slice(1).every(value => value == values[0]),
  "<": (...values) => values.slice(1).every((value, i) => value > values[i]),
  ">": (...values) => values.slice(1).every((value, i) => value < values[i]),
  "<=": (...values) => values.slice(1).every((value, i) => value >= values[i]),
  ">=": (...values) => values.slice(1).every((value, i) => value <= values[i]),
  map: (fun, list) => Array.from(list).map(value => fun(value)),
  reduce: (fun, list, init) => init ?
    Array.from(list).reduce((result, value) => fun(result, value), init) :
    Array.from(list).reduce((result, value) => fun(result, value)),
  all: (...values) => values.every(value => checkTruth(value)),
  any: (...values) => values.some(value => checkTruth(value)),
  head: list => list[0],
  tail: list => list.slice(1),
  init: list => list.slice(0, -1),
  last: list => list.at(-1),
  reverse: list => Array.from(list).reverse(),
  repeat: (count, value) => Array(count).fill(value),
  take: (count, list) => list.slice(0, count),
  "take-while": (fun, list) => {
    let index = 0
    for (let value of list) {
      if (!fun(value))
        return list.slice(0, index)
      index++
    }
    return list
  },
  "drop-while": (fun, list) => {
    let index = 0
    for (let value of list) {
      if (!fun(value))
        break
      index++
    }
    return list.slice(index)
  },
  drop: (...args) => {
    let list = args.at(-1)
    let count = args.length == 1 ? 1 : args[0]
    return list.slice(count)
  },
  concat: (...lists) => lists.flat(),
  append: (list, ...values) => [...list, ...values],
  get: (struct, ...keys) => keys.reduce((result, value) => result[value], struct),
  set: (struct, key, value) => {
    if (key.constructor === Array && key.length > 0) {
      let obj = struct
      for (let i = 0; i < key.length - 1; i++) {
        obj = obj[key[i]]
      }

      obj[key[key.length - 1]] = value
      return struct
    } else {
      return { ...struct, [key]: value }
    }
  },
  send: (...args) => args.length > 1 ? send({type: args[0], value: args[1]}) : send(args[0]),
  "send-async": effect => sendAsync(effect),

  "empty?": list => list == undefined || list.length == 0,

  navigate: (path) => () => { history.pushState(null, "", path); draw() },

  bounds: node => node.getBoundingClientRect(),
  "element-from-point": (x, y) => document.elementFromPoint(x, y),

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

  import: name => {
    name = toVariable(name)

    if (currentScope[`@${name}`])
      return

    if (jsModules[name] != undefined) {
      for (let [key, value] of Object.entries(jsModules[name]))
        currentScope[`${name}/${key}`] = value
      currentScope[`@${name}`] = true
      return
    }

    if (modules[name] == undefined)
      throw Error(`Module not found: ${name}`)

    let moduleScope = Object.create(currentScope)
    let previousScope = currentScope
    try {
      currentScope = moduleScope
      parse(tokenize(modules[name])).forEach(execute)
    } finally {
      currentScope = previousScope
    }

    for (let [key, value] of Object.entries(moduleScope))
      previousScope[`${name}/${key}`] = value
    previousScope[`@${name}`] = true
  },

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

  location: (pattern, ...body) => {
    pattern = execute(pattern)
    let pathname = window.location.pathname
    let patternParts = pattern.split("/")
    let pathParts = pathname.split("/")

    if (patternParts.length !== pathParts.length)
      return false

    let params = {}
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":"))
        params[patternParts[i].slice(1)] = pathParts[i]
      else if (patternParts[i] !== pathParts[i])
        return false
    }

    let localScope = Object.create(currentScope)
    for (let [key, value] of Object.entries(params))
      localScope[key] = value

    return executeInScope(["do", ...body], localScope)
  },

  render: expression => {
    return render(execute(expression))
  },

  raw: expression => ({ __raw: true, html: execute(expression) })
}

function render(view) {
  bind(view)
  let [tag, ...children] = view
  let attributesArgument = children[0]?.constructor == Object
    ? children.shift()
    : {}

  let element = document.createElement(tag)
  setAttributes(element, {}, attributesArgument)

  for (let child of children)
    if (checkTruth(child))
      element.append(child?.__raw
        ? document.createRange().createContextualFragment(child.html)
        : Array.isArray(child) ? render(child) : String(child))

  return element
}

let calls = new Map()
let nextCall = 0

function bind(value) {
  if (!Array.isArray(value))
    return

  function bindHandler(name) {
    let attributes = value[1]
    let handler = attributes?.[name]
    if (!handler || typeof handler == "number")
      return

    let id = nextCall++
    calls.set(String(id), async event => {
      let action = await (typeof handler == "function" ? handler(event) : handler)
      if (action != undefined)
        send(action)
    })
    attributes[name] = id
  }

  bindHandler("on-click")
  bindHandler("on-input")
  bindHandler("on-change")
  bindHandler("on-scroll")
  bindHandler("on-focus")
  bindHandler("on-submit")
  bindHandler("on-pointerdown")
  bindHandler("on-pointermove")
  bindHandler("on-pointerup")
  bindHandler("on-pointercancel")
}

function setAttributes(node, oldAttributes, attributes) {
  for (let name of node.getAttributeNames())
    if (!(name in attributes))
      node.removeAttribute(name)

  for (let [name, value] of Object.entries(attributes)) {
    if (name == "key")
      continue
    if (oldAttributes[name] === value)
      continue
    if (name in node)
      node[name] = value
    if (value === false)
      node.toggleAttribute(name, true)
    else
      node.setAttribute(name, value === true ? "" : value)
  }

  node._key = attributes.key
}

function patch(node, oldView, view) {
  if (oldView === view)
    return node

  if (!node)
    return render(view)

  if (!Array.isArray(view)) {
    let text = String(view)
    if (node.nodeType != Node.TEXT_NODE)
      return document.createTextNode(text)
    node.data = text
    return node
  }

  let [tag, ...children] = view
  if (!Array.isArray(oldView) || oldView[0] != tag ||
      node.nodeType != Node.ELEMENT_NODE || node.tagName.toLowerCase() != tag)
    return render(view)

  bind(view)
  let oldChildren = oldView.slice(1)
  let attributes = children[0]?.constructor == Object ? children.shift() : {}
  let oldAttributes = oldChildren[0]?.constructor == Object ? oldChildren.shift() : {}

  if (children.some(child => child?.__raw))
    return render(view)
  setAttributes(node, oldAttributes, attributes)

  oldChildren = oldChildren.filter(checkTruth)
  children = children.filter(checkTruth)
  let keyed = new Map([...node.childNodes]
    .filter(child => child._key != undefined)
    .map(child => [child._key, child]))
  let oldKeyed = new Map(oldChildren
    .filter(child => Array.isArray(child) && child[1]?.key != undefined)
    .map(child => [child[1].key, child]))
  for (let index = 0; index < children.length; index++) {
    let key = children[index][1]?.key
    let oldChild = key == undefined ? node.childNodes[index] : keyed.get(key)
    let oldChildView = key == undefined ? oldChildren[index] : oldKeyed.get(key)
    let newChild = patch(oldChild, oldChildView, children[index])
    if (!oldChild)
      node.append(newChild)
    else if (oldChild != newChild)
      node.replaceChild(newChild, oldChild)
    if (newChild != node.childNodes[index])
      node.insertBefore(newChild, node.childNodes[index] || null)
  }

  while (node.childNodes.length > children.length)
    node.lastChild.remove()

  return node
}

const htmlTags = [
  "a", "article", "aside", "button", "code", "div", "em", "fieldset",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "img",
  "input", "label", "legend", "li", "main", "nav", "ol", "option", "p", "pre",
  "section", "select", "small", "span", "strong", "table", "tbody", "td",
  "textarea", "th", "thead", "tr", "ul", "canvas", "b", "i", "br",
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
      return token.slice(1, -1).replace(/\\(.)/g, (_, escape) =>
        ({ n: "\n", r: "\r", t: "\t" }[escape] ?? escape))

    case /^-?\d+(\.\d+)?$/.test(token):
      return Number(token)

    case token.startsWith(":"):
      return token.slice(1)

    case basicFunctions[token] != undefined:
      return basicFunctions[token]

    case token == "true" || token == "#t":
      return true

    case token == "false" || token == "#f":
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

  if (value == undefined) {
    console.error("Cannot execute " + JSON.stringify(expression))
    return expression
  }

  return basicFunctions.get(value, ...args)
}

let model
let previousView

function send(action) {
  model = currentScope.update(model, action)
  draw()
}

async function sendAsync(effect) {
  let action = await effect()
  if (action != undefined)
    send(action)
}

function draw() {
  let view = currentScope.view(model)

  if (view?.constructor == Object) {
    document.title = view.title
    view = view.body
  }

  if (view instanceof Node) {
    document.body.replaceChildren(view)
    previousView = view
    currentScope["on-view"]?.(model)
    return
  }

  let node = patch(document.body.firstChild, previousView, view)
  if (node != document.body.firstChild)
    document.body.replaceChildren(node)
  previousView = view

  currentScope["on-view"]?.(model)
}

document.body.onclick = event =>
  trigger(event, "on-click")

document.body.oninput = event =>
  trigger(event, "on-input")

document.body.onchange = event =>
  trigger(event, "on-change")

// ponytail: capture lost if scheme unmounts the grabbed node mid-drag; keep dragged items keyed
document.body.onpointerdown = event => {
  event.target.setPointerCapture?.(event.pointerId)
  trigger(event, "on-pointerdown")
}

document.body.onpointermove = event =>
  trigger(event, "on-pointermove")

document.body.onpointerup = event =>
  trigger(event, "on-pointerup")

document.body.onpointercancel = event =>
  trigger(event, "on-pointercancel")

function findCall(event, name) {
  for (let node = event.target; node && node != document.body; node = node.parentElement) {
    let id = node.getAttribute?.(name)
    if (id != undefined) {
      event.preventDefault()
      return calls.get(id)
    }
  }
}

function trigger(event, name) {
  findCall(event, name)?.(event)
}

document.body.addEventListener("focus", event => trigger(event, "on-focus"), true)

document.body.addEventListener("scroll", event =>
  trigger(event, "on-scroll"), true)

document.body.onsubmit = event => {
  let handler = findCall(event, "on-submit")
  if (!handler)
    return

  event.preventDefault()
  handler(event)
}

window.addEventListener("popstate", () => draw())

parse(tokenize(code)).forEach(execute)
model = currentScope.init
draw()
