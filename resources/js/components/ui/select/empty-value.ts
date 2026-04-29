import { inject, provide, ref } from 'vue'

export const SELECT_EMPTY_VALUE = '__ahs_select_empty__'

type SelectEmptyValueContext = {
  hasEmptyItem: ReturnType<typeof ref<boolean>>
  registerEmptyItem: () => void
  unregisterEmptyItem: () => void
}

const selectEmptyValueContextKey = Symbol('select-empty-value-context')

export function provideSelectEmptyValueContext() {
  const emptyItemCount = ref(0)
  const hasEmptyItem = ref(false)

  const sync = () => {
    hasEmptyItem.value = emptyItemCount.value > 0
  }

  const context: SelectEmptyValueContext = {
    hasEmptyItem,
    registerEmptyItem: () => {
      emptyItemCount.value += 1
      sync()
    },
    unregisterEmptyItem: () => {
      emptyItemCount.value = Math.max(0, emptyItemCount.value - 1)
      sync()
    },
  }

  provide(selectEmptyValueContextKey, context)

  return context
}

export function useSelectEmptyValueContext() {
  return inject<SelectEmptyValueContext | null>(selectEmptyValueContextKey, null)
}

export function normalizeSelectValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => item === '' ? SELECT_EMPTY_VALUE : item) as T
  }

  return (value === '' ? SELECT_EMPTY_VALUE : value) as T
}

export function denormalizeSelectValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => item === SELECT_EMPTY_VALUE ? '' : item) as T
  }

  return (value === SELECT_EMPTY_VALUE ? '' : value) as T
}