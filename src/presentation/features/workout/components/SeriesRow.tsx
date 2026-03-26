interface Props {
  index: number
  expected: number
  actual: number | null
  onUpdate: (index: number, reps: number) => void
}

export function SeriesRow({ index, expected, actual, onUpdate }: Props) {
  return (
    <div className="series-row">
      <span>Serie {index + 1}</span>
      <input
        type="number"
        min={0}
        value={actual ?? expected}
        onChange={(e) => onUpdate(index, Number(e.target.value))}
      />
    </div>
  )
}
