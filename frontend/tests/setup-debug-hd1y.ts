import '@testing-library/jest-dom/vitest'
import { parseHTML } from 'linkedom'

const { window } = parseHTML('<!doctype html><html><body></body></html>')
const locationUrl = new URL('http://localhost/')
const activeElementState = {
  current: window.document.body as Element | null,
}
const checkedState = new WeakMap<HTMLInputElement, boolean>()
const labelActivatedInputs = new WeakSet<HTMLInputElement>()
const preClickedCheckableInputs = new WeakSet<HTMLInputElement>()
const preparedTextControls = new WeakSet<HTMLInputElement | HTMLTextAreaElement>()
const textSelectionState = new WeakMap<
  HTMLInputElement | HTMLTextAreaElement,
  { start: number; end: number; direction: 'forward' | 'backward' | 'none' }
>()

function clampOffset(value: number, max: number) {
  const numericValue = Number(value)
  return Math.max(0, Math.min(max, Number.isFinite(numericValue) ? numericValue : 0))
}

function getTextControlValue(element: HTMLInputElement | HTMLTextAreaElement) {
  return typeof element.value === 'string' ? element.value : ''
}

function getTextSelectionState(element: HTMLInputElement | HTMLTextAreaElement) {
  const valueLength = getTextControlValue(element).length
  const selection = textSelectionState.get(element)

  if (selection) {
    return {
      direction: selection.direction,
      end: clampOffset(selection.end, valueLength),
      start: clampOffset(selection.start, valueLength),
    }
  }

  return {
    direction: 'none' as const,
    end: valueLength,
    start: valueLength,
  }
}

function setTextSelectionState(
  element: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end = start,
  direction: 'forward' | 'backward' | 'none' = 'none',
) {
  const valueLength = getTextControlValue(element).length
  textSelectionState.set(element, {
    direction,
    end: clampOffset(end, valueLength),
    start: clampOffset(start, valueLength),
  })
}

function updateActiveElement(nextActiveElement: Element | null) {
  activeElementState.current = nextActiveElement
}

function isTextControlElement(
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof window.HTMLInputElement || element instanceof window.HTMLTextAreaElement
}

function isValueTrackableElement(
  element: EventTarget | null,
): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return (
    element instanceof window.HTMLInputElement ||
    element instanceof window.HTMLSelectElement ||
    element instanceof window.HTMLTextAreaElement
  )
}

function isLabelableElement(element: Element | null): element is Element {
  if (!element) {
    return false
  }

  switch (element.tagName) {
    case 'BUTTON':
    case 'INPUT':
    case 'METER':
    case 'OUTPUT':
    case 'PROGRESS':
    case 'SELECT':
    case 'TEXTAREA':
      return true
    default:
      return false
  }
}

function getLabelControl(label: HTMLLabelElement) {
  const htmlFor = label.getAttribute('for')

  if (htmlFor) {
    const associatedElement = label.ownerDocument.getElementById(htmlFor)
    return isLabelableElement(associatedElement) ? associatedElement : null
  }

  const nestedControl = label.querySelector('button, input, meter, output, progress, select, textarea')
  return isLabelableElement(nestedControl) ? nestedControl : null
}

function getControlLabels(element: Element) {
  const labels = Array.from(element.ownerDocument.querySelectorAll('label'))
  return labels.filter((label) => getLabelControl(label as HTMLLabelElement) === element)
}

function isCheckableInput(element: Element | null): element is HTMLInputElement {
  return (
    element instanceof window.HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  )
}

function getCheckedValue(input: HTMLInputElement) {
  if (!isCheckableInput(input)) {
    return false
  }

  if (checkedState.has(input)) {
    return checkedState.get(input) ?? false
  }

  return input.hasAttribute('checked')
}

function setCheckedValue(input: HTMLInputElement, nextChecked: boolean) {
  if (!isCheckableInput(input)) {
    return
  }

  if (input.type === 'radio' && nextChecked) {
    const rootNode = input.form ?? input.ownerDocument
    const sameNameRadios = Array.from(rootNode.querySelectorAll('input')).filter(
      (element): element is HTMLInputElement =>
        isCheckableInput(element) &&
        element.type === 'radio' &&
        element !== input &&
        element.getAttribute('name') === input.getAttribute('name'),
    )

    for (const radio of sameNameRadios) {
      checkedState.set(radio, false)
      radio.removeAttribute('checked')
    }
  }

  checkedState.set(input, nextChecked)

  if (nextChecked) {
    input.setAttribute('checked', '')
    return
  }

  input.removeAttribute('checked')
}

function resetReactValueTracker(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  const tracker = (
    element as typeof element & {
      _valueTracker?: {
        setValue: (value: string) => void
      }
    }
  )._valueTracker

  if (!tracker?.setValue) {
    return
  }

  const currentValue =
    isCheckableInput(element) && element instanceof window.HTMLInputElement
      ? element.checked
        ? 'true'
        : 'false'
      : String(element.value ?? '')

  tracker.setValue(currentValue === '' ? '__codex_previous_value__' : '')
}

function dispatchBubbledEvent(target: Element, type: string) {
  target.dispatchEvent(new window.Event(type, { bubbles: true }))
}

function dispatchEvent(target: Element, type: string, bubbles = false) {
  target.dispatchEvent(new window.Event(type, { bubbles }))
}

function syncCheckableInputFromClick(input: HTMLInputElement) {
  const previousChecked = getCheckedValue(input)
  const nextChecked = input.type === 'radio' ? true : !previousChecked

  if (previousChecked === nextChecked) {
    return
  }

  setCheckedValue(input, nextChecked)
  dispatchBubbledEvent(input, 'input')
  dispatchBubbledEvent(input, 'change')
}

function isSubmitControl(element: Element | null): element is HTMLButtonElement | HTMLInputElement {
  if (!element) {
    return false
  }

  if (element instanceof window.HTMLButtonElement) {
    return (element.getAttribute('type')?.toLowerCase() ?? 'submit') === 'submit'
  }

  return element instanceof window.HTMLInputElement && element.type === 'submit'
}

function isFormElement(element: Element | null): element is HTMLElement {
  return element instanceof window.HTMLElement && element.tagName === 'FORM'
}

function dispatchFormSubmit(form: Element) {
  if (!isFormElement(form)) {
    return
  }

  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
}

function isUserEventStringValue(value: unknown): value is String {
  return typeof value === 'object' && value instanceof String
}

function prepareTextControlForUserEvent(element: HTMLInputElement | HTMLTextAreaElement) {
  if (preparedTextControls.has(element)) {
    return
  }

  preparedTextControls.add(element)

  const prototypeDescriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value')
  const ownDescriptor = Object.getOwnPropertyDescriptor(element, 'value')

  if (!prototypeDescriptor?.get || !prototypeDescriptor?.set || !ownDescriptor?.get || !ownDescriptor?.set) {
    return
  }

  Object.defineProperty(element, 'value', {
    configurable: true,
    enumerable: ownDescriptor.enumerable ?? prototypeDescriptor.enumerable ?? false,
    get() {
      return ownDescriptor.get.call(this)
    },
    set(value: string | String) {
      const setter = isUserEventStringValue(value) ? prototypeDescriptor.set : ownDescriptor.set
      setter.call(this, String(value))
    },
  })
}

function defineWindowProperty<T extends object, K extends PropertyKey>(
  target: T,
  property: K,
  descriptor: PropertyDescriptor,
) {
  Object.defineProperty(target, property, {
    configurable: true,
    ...descriptor,
  })
}

function createRange() {
  const rangeState = {
    endContainer: null as Node | null,
    endOffset: 0,
    startContainer: null as Node | null,
    startOffset: 0,
  }

  const getNodeOffsetLimit = (node: Node) => (node.nodeType === window.Node.TEXT_NODE ? node.textContent?.length ?? 0 : node.childNodes.length)
  const normalizeOffset = (node: Node, offset: number) => clampOffset(offset, getNodeOffsetLimit(node))

  return {
    get collapsed() {
      return (
        rangeState.startContainer === rangeState.endContainer &&
        rangeState.startOffset === rangeState.endOffset
      )
    },
    cloneContents: () => window.document.createDocumentFragment(),
    cloneRange: () => {
      const clone = createRange()
      if (rangeState.startContainer) {
        clone.setStart(rangeState.startContainer, rangeState.startOffset)
      }
      if (rangeState.endContainer) {
        clone.setEnd(rangeState.endContainer, rangeState.endOffset)
      }
      return clone
    },
    collapse: (toStart = false) => {
      if (toStart) {
        rangeState.endContainer = rangeState.startContainer
        rangeState.endOffset = rangeState.startOffset
        return
      }

      rangeState.startContainer = rangeState.endContainer
      rangeState.startOffset = rangeState.endOffset
    },
    get commonAncestorContainer() {
      return rangeState.startContainer ?? rangeState.endContainer ?? window.document.body
    },
    deleteContents: () => undefined,
    detach: () => undefined,
    extractContents: () => window.document.createDocumentFragment(),
    insertNode: () => undefined,
    get endContainer() {
      return rangeState.endContainer
    },
    get endOffset() {
      return rangeState.endOffset
    },
    selectNode: (node: Node) => {
      const parentNode = node.parentNode ?? window.document.body
      const nodeIndex = Array.from(parentNode.childNodes).indexOf(node)
      rangeState.startContainer = parentNode
      rangeState.endContainer = parentNode
      rangeState.startOffset = Math.max(nodeIndex, 0)
      rangeState.endOffset = Math.max(nodeIndex, 0) + 1
    },
    selectNodeContents: (node: Node) => {
      rangeState.startContainer = node
      rangeState.endContainer = node
      rangeState.startOffset = 0
      rangeState.endOffset = getNodeOffsetLimit(node)
    },
    setEnd: (node: Node, offset: number) => {
      rangeState.endContainer = node
      rangeState.endOffset = normalizeOffset(node, offset)
    },
    setEndAfter: (node: Node) => {
      const parentNode = node.parentNode ?? window.document.body
      const nodeIndex = Array.from(parentNode.childNodes).indexOf(node)
      rangeState.endContainer = parentNode
      rangeState.endOffset = Math.max(nodeIndex, 0) + 1
    },
    setEndBefore: (node: Node) => {
      const parentNode = node.parentNode ?? window.document.body
      const nodeIndex = Array.from(parentNode.childNodes).indexOf(node)
      rangeState.endContainer = parentNode
      rangeState.endOffset = Math.max(nodeIndex, 0)
    },
    setStart: (node: Node, offset: number) => {
      rangeState.startContainer = node
      rangeState.startOffset = normalizeOffset(node, offset)
    },
    setStartAfter: (node: Node) => {
      const parentNode = node.parentNode ?? window.document.body
      const nodeIndex = Array.from(parentNode.childNodes).indexOf(node)
      rangeState.startContainer = parentNode
      rangeState.startOffset = Math.max(nodeIndex, 0) + 1
    },
    setStartBefore: (node: Node) => {
      const parentNode = node.parentNode ?? window.document.body
      const nodeIndex = Array.from(parentNode.childNodes).indexOf(node)
      rangeState.startContainer = parentNode
      rangeState.startOffset = Math.max(nodeIndex, 0)
    },
    get startContainer() {
      return rangeState.startContainer
    },
    get startOffset() {
      return rangeState.startOffset
    },
    toString: () => '',
  }
}

const location = {
  assign: () => undefined,
  hash: locationUrl.hash,
  host: locationUrl.host,
  hostname: locationUrl.hostname,
  href: locationUrl.href,
  origin: locationUrl.origin,
  pathname: locationUrl.pathname,
  port: locationUrl.port,
  protocol: locationUrl.protocol,
  reload: () => undefined,
  replace: () => undefined,
  search: locationUrl.search,
  toString: () => locationUrl.toString(),
}

const history = {
  back: () => undefined,
  forward: () => undefined,
  go: () => undefined,
  length: 1,
  pushState: () => undefined,
  replaceState: () => undefined,
  scrollRestoration: 'auto',
  state: null,
}

function createStorage() {
  const storage = new Map<string, string>()

  return {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    setItem: (key: string, value: string) => {
      storage.set(key, String(value))
    },
  }
}

const localStorage = createStorage()
const sessionStorage = createStorage()
const selection = {
  addRange: (range: { startContainer?: Node | null; startOffset?: number; endContainer?: Node | null; endOffset?: number }) => {
    selection.rangeCount = 1
    selection.anchorNode = range.startContainer ?? null
    selection.anchorOffset = range.startOffset ?? 0
    selection.focusNode = range.endContainer ?? selection.anchorNode
    selection.focusOffset = range.endOffset ?? selection.anchorOffset
    selection.isCollapsed = selection.anchorNode === selection.focusNode && selection.anchorOffset === selection.focusOffset
  },
  anchorNode: null as Node | null,
  anchorOffset: 0,
  collapse: (node: Node | null, offset = 0) => {
    selection.anchorNode = node
    selection.focusNode = node
    selection.anchorOffset = offset
    selection.focusOffset = offset
    selection.isCollapsed = true
  },
  extend: (node: Node, offset = 0) => {
    selection.focusNode = node
    selection.focusOffset = offset
    selection.isCollapsed = selection.anchorNode === node && selection.anchorOffset === offset
  },
  focusNode: null as Node | null,
  focusOffset: 0,
  getRangeAt: () => ({
    cloneRange: () => ({
      cloneRange: () => undefined,
    }),
  }),
  isCollapsed: true,
  rangeCount: 0,
  removeAllRanges: () => {
    selection.anchorNode = null
    selection.focusNode = null
    selection.anchorOffset = 0
    selection.focusOffset = 0
    selection.isCollapsed = true
    selection.rangeCount = 0
  },
  setBaseAndExtent: (anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number) => {
    selection.anchorNode = anchorNode
    selection.focusNode = focusNode
    selection.anchorOffset = anchorOffset
    selection.focusOffset = focusOffset
    selection.isCollapsed = anchorNode === focusNode && anchorOffset === focusOffset
  },
  toString: () => '',
}

function defineGlobalProperty(property: string, value: unknown) {
  Object.defineProperty(globalThis, property, {
    configurable: true,
    writable: true,
    value,
  })
}

console.log("debug:window-location");
Object.defineProperty(window, 'location', {
  configurable: true,
  value: location,
})
Object.defineProperty(window, 'history', {
  configurable: true,
  value: history,
})
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorage,
})
Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: sessionStorage,
})
Object.defineProperty(window, 'getSelection', {
  configurable: true,
  value: () => selection,
})
Object.defineProperty(window.document, 'getSelection', {
  configurable: true,
  value: () => selection,
})
Object.defineProperty(window.document, 'activeElement', {
  configurable: true,
  get: () => activeElementState.current ?? window.document.body,
})
Object.defineProperty(window.document, 'hasFocus', {
  configurable: true,
  value: () => true,
})
console.log("debug:document-events");
for (const eventName of ['onchange', 'onfocusin', 'onfocusout', 'oninput', 'onkeydown', 'onkeyup', 'onselectionchange'] as const) {
  defineWindowProperty(window.document, eventName, {
    value: null,
    writable: true,
  })
}

console.log("debug:input-type");
defineWindowProperty(window.HTMLInputElement.prototype, 'type', {
  get(this: HTMLInputElement) {
    return this.getAttribute('type')?.toLowerCase() ?? 'text'
  },
  set(this: HTMLInputElement, value: string) {
    this.setAttribute('type', String(value).toLowerCase())
  },
})
defineWindowProperty(window.HTMLSelectElement.prototype, 'type', {
  get(this: HTMLSelectElement) {
    return this.multiple ? 'select-multiple' : 'select-one'
  },
})
defineWindowProperty(window.HTMLOptionElement.prototype, 'disabled', {
  get(this: HTMLOptionElement) {
    return this.hasAttribute('disabled')
  },
  set(this: HTMLOptionElement, value: boolean) {
    if (value) {
      this.setAttribute('disabled', '')
      return
    }

    this.removeAttribute('disabled')
  },
})
defineWindowProperty(window.HTMLOptionElement.prototype, 'label', {
  get(this: HTMLOptionElement) {
    return this.getAttribute('label') ?? this.textContent ?? ''
  },
  set(this: HTMLOptionElement, value: string) {
    this.setAttribute('label', String(value))
  },
})
defineWindowProperty(window.HTMLOptionElement.prototype, 'text', {
  get(this: HTMLOptionElement) {
    return this.textContent ?? ''
  },
  set(this: HTMLOptionElement, value: string) {
    this.textContent = String(value)
  },
})
defineWindowProperty(window.HTMLOptionElement.prototype, 'selected', {
  get(this: HTMLOptionElement) {
    const select = this.parentElement

    if (select instanceof window.HTMLSelectElement && !select.multiple) {
      return select.value === this.value
    }

    return this.hasAttribute('selected')
  },
  set(this: HTMLOptionElement, value: boolean) {
    const select = this.parentElement
    const nextSelected = Boolean(value)

    if (select instanceof window.HTMLSelectElement && !select.multiple && nextSelected) {
      for (const option of Array.from(select.querySelectorAll('option'))) {
        if (option === this) {
          option.setAttribute('selected', '')
          continue
        }

        option.removeAttribute('selected')
      }

      return
    }

    if (nextSelected) {
      this.setAttribute('selected', '')
      return
    }

    this.removeAttribute('selected')
  },
})
defineWindowProperty(window.HTMLLabelElement.prototype, 'control', {
  get(this: HTMLLabelElement) {
    return getLabelControl(this)
  },
})

for (const constructor of [
  window.HTMLButtonElement,
  window.HTMLInputElement,
  window.HTMLSelectElement,
  window.HTMLTextAreaElement,
] as const) {
  defineWindowProperty(constructor.prototype, 'labels', {
    get(this: Element) {
      return getControlLabels(this)
    },
  })
}

for (const constructor of [
  window.HTMLInputElement,
  window.HTMLSelectElement,
  window.HTMLTextAreaElement,
] as const) {
  defineWindowProperty(constructor.prototype, 'required', {
    get(this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
      return this.hasAttribute('required')
    },
    set(this: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: boolean) {
      if (value) {
        this.setAttribute('required', '')
        return
      }

      this.removeAttribute('required')
    },
  })
}

console.log("debug:text-selection-loop");
for (const constructor of [window.HTMLInputElement, window.HTMLTextAreaElement] as const) {
  defineWindowProperty(constructor.prototype, 'selectionStart', {
    get(this: HTMLInputElement | HTMLTextAreaElement) {
      return getTextSelectionState(this).start
    },
    set(this: HTMLInputElement | HTMLTextAreaElement, value: number | null) {
      const nextValue = value ?? 0
      const currentSelection = getTextSelectionState(this)
      setTextSelectionState(this, nextValue, currentSelection.end, currentSelection.direction)
    },
  })
  defineWindowProperty(constructor.prototype, 'selectionEnd', {
    get(this: HTMLInputElement | HTMLTextAreaElement) {
      return getTextSelectionState(this).end
    },
    set(this: HTMLInputElement | HTMLTextAreaElement, value: number | null) {
      const nextValue = value ?? 0
      const currentSelection = getTextSelectionState(this)
      setTextSelectionState(this, currentSelection.start, nextValue, currentSelection.direction)
    },
  })
  defineWindowProperty(constructor.prototype, 'selectionDirection', {
    get(this: HTMLInputElement | HTMLTextAreaElement) {
      return getTextSelectionState(this).direction
    },
    set(this: HTMLInputElement | HTMLTextAreaElement, value: 'forward' | 'backward' | 'none' | null) {
      const currentSelection = getTextSelectionState(this)
      setTextSelectionState(this, currentSelection.start, currentSelection.end, value ?? 'none')
    },
  })
  defineWindowProperty(constructor.prototype, 'setSelectionRange', {
    value(this: HTMLInputElement | HTMLTextAreaElement, start: number, end = start, direction?: 'forward' | 'backward' | 'none') {
      setTextSelectionState(this, start, end, direction ?? 'none')
    },
  })
  defineWindowProperty(constructor.prototype, 'select', {
    value(this: HTMLInputElement | HTMLTextAreaElement) {
      setTextSelectionState(this, 0, getTextControlValue(this).length)
    },
  })
}
console.log("debug:input-checked");
defineWindowProperty(window.HTMLInputElement.prototype, 'checked', {
  get(this: HTMLInputElement) {
    return getCheckedValue(this)
  },
  set(this: HTMLInputElement, value: boolean) {
    setCheckedValue(this, Boolean(value))
  },
})
const originalInputClick = window.HTMLInputElement.prototype.click
defineWindowProperty(window.HTMLInputElement.prototype, 'click', {
  value(this: HTMLInputElement) {
    if (isCheckableInput(this)) {
      preClickedCheckableInputs.add(this)
      syncCheckableInputFromClick(this)
    }

    originalInputClick?.call(this)

    if (isCheckableInput(this)) {
      preClickedCheckableInputs.delete(this)
    }
  },
})
defineWindowProperty(window.HTMLFormElement.prototype, 'requestSubmit', {
  value(this: HTMLFormElement) {
    dispatchFormSubmit(this)
  },
})
defineWindowProperty(window.HTMLFormElement.prototype, 'submit', {
  value(this: HTMLFormElement) {
    dispatchFormSubmit(this)
  },
})
console.log("debug:dispatch-event-patch");
const originalDispatchEvent = window.EventTarget.prototype.dispatchEvent
defineWindowProperty(window.EventTarget.prototype, 'dispatchEvent', {
  value(this: EventTarget, event: Event) {
    if (isValueTrackableElement(this)) {
      if (this instanceof window.HTMLInputElement && isCheckableInput(this) && event.type === 'click') {
        resetReactValueTracker(this)
      }

      if ((event.type === 'change' || event.type === 'input') && !(this instanceof window.HTMLInputElement && isCheckableInput(this))) {
        resetReactValueTracker(this)
      }
    }

    return originalDispatchEvent.call(this, event)
  },
})

console.log("debug:create-range");
Object.defineProperty(window.document, 'createRange', {
  configurable: true,
  value: () => createRange(),
})

const originalElementFocus = window.HTMLElement.prototype.focus
defineWindowProperty(window.HTMLElement.prototype, 'focus', {
  value(this: HTMLElement) {
    originalElementFocus?.call(this)
    updateActiveElement(this)
    if (isTextControlElement(this)) {
      prepareTextControlForUserEvent(this)
    }
    dispatchEvent(this, 'focus')
    dispatchBubbledEvent(this, 'focusin')
  },
})
const originalElementBlur = window.HTMLElement.prototype.blur
defineWindowProperty(window.HTMLElement.prototype, 'blur', {
  value(this: HTMLElement) {
    originalElementBlur?.call(this)
    dispatchEvent(this, 'blur')
    dispatchBubbledEvent(this, 'focusout')
    if (activeElementState.current === this) {
      updateActiveElement(window.document.body)
    }
  },
})
console.log("debug:add-click-listener-capture");
window.document.addEventListener(
  'click',
  (event) => {
    const target = event.target

    if (
      isCheckableInput(target instanceof window.Element ? target : null) &&
      !labelActivatedInputs.has(target) &&
      !preClickedCheckableInputs.has(target)
    ) {
      syncCheckableInputFromClick(target)
    }
  },
  true,
)
console.log("debug:add-click-listener-bubble");
window.document.addEventListener('click', (event) => {
  if (event.defaultPrevented) {
    return
  }

  const target = event.target
  if (!(target instanceof window.Element)) {
    return
  }

  const label = target.closest('label')
  if (label) {
    const control = getLabelControl(label as HTMLLabelElement)

    if (control instanceof window.HTMLElement && control !== target) {
      control.focus()
    }

    if (isCheckableInput(control) && control !== target) {
      labelActivatedInputs.add(control)
      control.click()
      labelActivatedInputs.delete(control)
      return
    }
  }

  const submitControl = target.closest('button, input')
  if (isSubmitControl(submitControl) && !submitControl.hasAttribute('disabled')) {
    const form = submitControl.closest('form')
    if (isFormElement(form)) {
      dispatchFormSubmit(form)
    }
  }
})

console.log("debug:raf");
window.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0)
window.cancelAnimationFrame = (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle)
window.open = typeof window.open === 'function' ? window.open.bind(window) : (() => null)
const originalMatchMedia =
  typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null
const originalGetComputedStyle =
  typeof window.getComputedStyle === 'function' ? window.getComputedStyle.bind(window) : null
window.matchMedia =
  originalMatchMedia
    ? (query: string) => originalMatchMedia(query)
    : ((query: string) => ({
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }))
window.getComputedStyle =
  originalGetComputedStyle
    ? (element: Element, pseudoElement?: string) => originalGetComputedStyle(element, pseudoElement)
    : (() => ({
        getPropertyPriority: () => '',
        getPropertyValue: () => '',
        item: () => '',
        removeProperty: () => '',
        setProperty: () => undefined,
      }))

console.log("debug:globals");
defineGlobalProperty('window', window)
defineGlobalProperty('self', window)
defineGlobalProperty('document', window.document)
defineGlobalProperty('navigator', window.navigator)
defineGlobalProperty('location', location)
defineGlobalProperty('history', history)
defineGlobalProperty('localStorage', localStorage)
defineGlobalProperty('sessionStorage', sessionStorage)
defineGlobalProperty('open', window.open)
defineGlobalProperty('CustomEvent', window.CustomEvent)
defineGlobalProperty('Document', window.Document)
defineGlobalProperty('Element', window.Element)
defineGlobalProperty('Event', window.Event)
defineGlobalProperty('EventTarget', window.EventTarget)
defineGlobalProperty('HTMLElement', window.HTMLElement)
defineGlobalProperty('HTMLButtonElement', window.HTMLButtonElement)
defineGlobalProperty('HTMLDivElement', window.HTMLDivElement)
defineGlobalProperty('HTMLFormElement', window.HTMLFormElement)
defineGlobalProperty('HTMLInputElement', window.HTMLInputElement)
defineGlobalProperty('HTMLLabelElement', window.HTMLLabelElement)
defineGlobalProperty('HTMLOptionElement', window.HTMLOptionElement)
defineGlobalProperty('HTMLSelectElement', window.HTMLSelectElement)
defineGlobalProperty('HTMLTableRowElement', window.HTMLTableRowElement)
defineGlobalProperty('HTMLTextAreaElement', window.HTMLTextAreaElement)
defineGlobalProperty('Node', window.Node)
defineGlobalProperty('Range', window.Range)
defineGlobalProperty('SVGElement', window.SVGElement)
defineGlobalProperty('Text', window.Text)
defineGlobalProperty('getComputedStyle', window.getComputedStyle)
defineGlobalProperty('matchMedia', window.matchMedia)
defineGlobalProperty('requestAnimationFrame', window.requestAnimationFrame)
defineGlobalProperty('cancelAnimationFrame', window.cancelAnimationFrame)
defineGlobalProperty('IS_REACT_ACT_ENVIRONMENT', true)
