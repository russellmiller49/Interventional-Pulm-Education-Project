import 'server-only'
import refreshJson from '../../../../data/ip-device-intelligence/generated/status-refresh.json'
import { statusRefreshSchema } from '../domain/status-refresh-schema'

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const artifact = freeze(statusRefreshSchema.parse(refreshJson))
const rows = new Map(artifact.rows.map((row) => [row.product_id, row]))
export function getStatusRefresh(productId: string) {
  return rows.get(productId) ?? null
}
