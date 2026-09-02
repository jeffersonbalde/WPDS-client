import { useEffect, useState } from 'react'
import api from '../api/client'
import WestPrimeLoader from '../components/common/WestPrimeLoader'

export default function SystemPage() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    api.get('/system/status').then((res) => setStatus(res.data))
  }, [])

  if (!status) {
    return <WestPrimeLoader variant="page" message="Loading…" label="Loading" />
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">System Maintenance</h1>
      <div className="bg-white border rounded p-5 space-y-3 text-sm max-w-xl">
        <Row label="Application" value={status.app} />
        <Row label="Environment" value={status.environment} />
        <Row label="Database" value={status.database} />
        <Row label="Active Users" value={status.users_active} />
        <Row label="Inactive Users" value={status.users_inactive} />
        <Row label="Timestamp" value={status.timestamp} />
        <div className="pt-3 border-t text-gray-600">{status.backup_note}</div>
        <p className="text-gray-600">
          Recommended backup: export SQLite/MySQL dump regularly and store securely. For thesis demo, use <code>php artisan migrate:fresh --seed</code> to restore sample data.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
