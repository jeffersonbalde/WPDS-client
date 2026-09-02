import WestPrimeLoader from './WestPrimeLoader'

export default function PageLoadingRow({
  colSpan = 1,
  message = 'Loading…',
  cellClassName = 'wp-flat__empty wp-flat__loading-cell',
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={cellClassName}>
        <WestPrimeLoader variant="inline" message={message} label={message} />
      </td>
    </tr>
  )
}
