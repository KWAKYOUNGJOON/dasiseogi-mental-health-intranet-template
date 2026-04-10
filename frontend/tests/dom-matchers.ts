type TextContentMatcherOptions = {
  normalizeWhitespace?: boolean
}

type ExtendableExpect = {
  extend: (matchers: Record<string, unknown>) => void
}

type VitestRuntimeGlobal = {
  __vitest_index__?: {
    expect?: ExtendableExpect
  }
  expect?: ExtendableExpect
}

function isElementWithTextContent(value: unknown): value is { textContent: string | null } {
  return typeof value === 'object' && value !== null && 'textContent' in value
}

function isDisableableElement(
  value: unknown,
): value is { disabled?: boolean; hasAttribute?: (name: string) => boolean } {
  return typeof value === 'object' && value !== null
}

function isValueElement(value: unknown): value is { value?: unknown } {
  return typeof value === 'object' && value !== null && 'value' in value
}

function normalizeTextContent(text: string, normalizeWhitespace = true) {
  return normalizeWhitespace ? text.replace(/\s+/g, ' ').trim() : text
}

const globalExpect = (globalThis as typeof globalThis & VitestRuntimeGlobal).expect
  ?? (globalThis as typeof globalThis & VitestRuntimeGlobal).__vitest_index__?.expect

globalExpect?.extend({
  toBeDisabled(received: unknown) {
    const disabled =
      isDisableableElement(received) &&
      (received.disabled === true || received.hasAttribute?.('disabled') === true)

    return {
      pass: disabled,
      message: () =>
        `expected ${this.utils.printReceived(received)} ${this.isNot ? 'not ' : ''}to be disabled`,
    }
  },
  toBeEnabled(received: unknown) {
    const disabled =
      isDisableableElement(received) &&
      (received.disabled === true || received.hasAttribute?.('disabled') === true)

    return {
      pass: !disabled,
      message: () =>
        `expected ${this.utils.printReceived(received)} ${this.isNot ? 'not ' : ''}to be enabled`,
    }
  },
  toHaveTextContent(
    received: unknown,
    expected: RegExp | string,
    options: TextContentMatcherOptions = {},
  ) {
    if (!isElementWithTextContent(received)) {
      return {
        pass: false,
        message: () =>
          `expected ${this.utils.printReceived(received)} to have text content`,
      }
    }

    const actualText = normalizeTextContent(
      received.textContent ?? '',
      options.normalizeWhitespace ?? true,
    )
    const pass =
      expected instanceof RegExp
        ? expected.test(actualText)
        : actualText.includes(
            normalizeTextContent(String(expected), options.normalizeWhitespace ?? true),
          )

    return {
      pass,
      message: () =>
        `expected ${this.utils.printReceived(actualText)} ${this.isNot ? 'not ' : ''}to contain ${this.utils.printExpected(expected)}`,
    }
  },
  toHaveValue(received: unknown, expected: unknown) {
    if (!isValueElement(received)) {
      return {
        pass: false,
        message: () =>
          `expected ${this.utils.printReceived(received)} to have a value property`,
      }
    }

    const actualValue = received.value
    const pass = Object.is(actualValue, expected)

    return {
      pass,
      message: () =>
        `expected value ${this.utils.printReceived(actualValue)} ${this.isNot ? 'not ' : ''}to equal ${this.utils.printExpected(expected)}`,
    }
  },
})

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeDisabled(): T
    toBeEnabled(): T
    toHaveTextContent(expected: RegExp | string, options?: TextContentMatcherOptions): T
    toHaveValue(expected: unknown): T
  }

  interface AsymmetricMatchersContaining {
    toBeDisabled(): void
    toBeEnabled(): void
    toHaveTextContent(expected: RegExp | string, options?: TextContentMatcherOptions): void
    toHaveValue(expected: unknown): void
  }
}
