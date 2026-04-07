import { useState, useRef } from 'react'
import shoes from '@data/shoes.json'

const MAX_SHOES = 5
const MAX_SCORE = 50

function ScoreTooltip() {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none flex items-center justify-center cursor-help"
        aria-label="Score info"
      >
        ?
      </button>
      {visible && (
        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 z-20 shadow-lg">
          Enter the score shown next to the shoe in Court Shoe Finder. Scores range from 0 to {MAX_SCORE}.
        </span>
      )}
    </span>
  )
}

export default function ShoeEntryForm({ onSearch }) {
  const [query, setQuery] = useState('')
  const [selectedShoe, setSelectedShoe] = useState(null)
  const [score, setScore] = useState('')
  const [scoreError, setScoreError] = useState('')
  const [shoeList, setShoeList] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const closeTimer = useRef(null)

  const [gender, setGender] = useState('Mens')
  const [courtType, setCourtType] = useState('All Court')
  const [size, setSize] = useState('')

  const activeShoes = shoes.filter(s => s.active)
  const filtered = query.length > 0
    ? activeShoes
        .filter(s =>
          `${s.brand} ${s.model}`.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
    : []

  const handleQueryChange = (e) => {
    setQuery(e.target.value)
    setSelectedShoe(null)
    setShowDropdown(true)
  }

  const handleSelect = (shoe) => {
    setSelectedShoe(shoe)
    setQuery(`${shoe.brand} ${shoe.model}`)
    setShowDropdown(false)
  }

  const handleScoreChange = (e) => {
    const val = e.target.value
    setScore(val)
    if (val === '') {
      setScoreError('')
      return
    }
    const num = parseInt(val, 10)
    if (isNaN(num) || !Number.isInteger(num)) {
      setScoreError('Score must be a whole number.')
    } else if (num < 0 || num > MAX_SCORE) {
      setScoreError(`Score must be between 0 and ${MAX_SCORE}.`)
    } else {
      setScoreError('')
    }
  }

  const handleAdd = () => {
    if (!selectedShoe) return
    const scoreNum = parseInt(score, 10)
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > MAX_SCORE) return
    if (shoeList.length >= MAX_SHOES) return
    setShoeList([...shoeList, { ...selectedShoe, matchScore: scoreNum }])
    setSelectedShoe(null)
    setQuery('')
    setScore('')
    setScoreError('')
  }

  const handleRemove = (index) => {
    setShoeList(shoeList.filter((_, i) => i !== index))
  }

  const handleInputBlur = () => {
    closeTimer.current = setTimeout(() => setShowDropdown(false), 150)
  }

  const handleDropdownMouseDown = () => {
    clearTimeout(closeTimer.current)
  }

  const canAdd = selectedShoe && score !== '' && !scoreError && parseInt(score, 10) >= 0 && parseInt(score, 10) <= MAX_SCORE && shoeList.length < MAX_SHOES

  return (
    <div className="w-full max-w-xl mx-auto px-4">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Enter your Court Shoe Finder results</h2>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>Mens</option>
            <option>Womens</option>
            <option>Kids</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Court type</label>
          <select
            value={courtType}
            onChange={(e) => setCourtType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>All Court</option>
            <option>Clay</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Size (UK)</label>
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="e.g. 9.5"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => query.length > 0 && setShowDropdown(true)}
          onBlur={handleInputBlur}
          placeholder="Search for a shoe (e.g. ASICS, Barricade...)"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {showDropdown && filtered.length > 0 && (
          <ul
            onMouseDown={handleDropdownMouseDown}
            className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto"
          >
            {filtered.map(shoe => (
              <li
                key={shoe.id}
                onClick={() => handleSelect(shoe)}
                className="px-4 py-3 text-sm cursor-pointer hover:bg-blue-50 flex justify-between items-center"
              >
                <span>
                  <span className="font-medium text-gray-900">{shoe.brand}</span>
                  <span className="text-gray-600"> {shoe.model}</span>
                </span>
                {shoe.generation === 'previous' && (
                  <span className="text-xs text-gray-400 ml-2">prev. gen</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Score input + Add button */}
      <div className="mb-6">
        <div className="flex items-center mb-1.5">
          <label className="text-xs font-medium text-gray-600">Match score</label>
          <ScoreTooltip />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="number"
              value={score}
              onChange={handleScoreChange}
              placeholder="e.g. 38"
              min={0}
              max={MAX_SCORE}
              className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                scoreError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
              }`}
            />
            {scoreError && (
              <p className="mt-1 text-xs text-red-500">{scoreError}</p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="px-5 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors self-start"
          >
            Add
          </button>
        </div>
      </div>

      {/* Shoe list */}
      {shoeList.length > 0 && (
        <ul className="mb-6 space-y-2">
          {shoeList.map((shoe, index) => (
            <li
              key={index}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <span className="text-sm text-gray-800 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium break-words">{shoe.brand} {shoe.model}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                  {shoe.matchScore} / 50
                </span>
              </span>
              <button
                onClick={() => handleRemove(index)}
                className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none ml-4"
                aria-label="Remove shoe"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {shoeList.length > 0 && (
        <p className="text-xs text-gray-500 mb-4">
          {shoeList.length} of {MAX_SHOES} shoes added
        </p>
      )}

      {/* Find Best Prices button */}
      {shoeList.length > 0 && (
        <button
          onClick={() => onSearch(shoeList, { gender, courtType, size })}
          className="w-full py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-base"
        >
          Find Best Prices
        </button>
      )}
    </div>
  )
}
