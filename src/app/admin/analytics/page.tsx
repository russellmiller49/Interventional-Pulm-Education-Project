import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function AdminAnalyticsPage() {
  redirect('/admin' as Route)
}
