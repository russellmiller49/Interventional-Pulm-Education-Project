import type { QuantityExpression } from './types'

export function evaluateQuantityExpression(expression: QuantityExpression): number {
  return expression.value
}
