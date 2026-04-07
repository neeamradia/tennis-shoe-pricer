import { useState } from 'react'
import OnboardingScreen from './components/OnboardingScreen'
import ShoeEntryForm from './components/ShoeEntryForm'
import ResultsPage from './components/ResultsPage'

export default function App() {
  const [screen, setScreen] = useState('onboarding') // 'onboarding' | 'entry' | 'results'
  const [searchList, setSearchList] = useState([])
  const [filters, setFilters] = useState({})

  const handleSearch = (shoeList, filterValues) => {
    setSearchList(shoeList)
    setFilters(filterValues)
    setScreen('results')
  }

  const handleReset = () => {
    setSearchList([])
    setFilters({})
    setScreen('onboarding')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 text-center">TennisShoeHunter</h1>
      </header>

      <main className="py-10">
        {screen === 'onboarding' && (
          <OnboardingScreen onStart={() => setScreen('entry')} />
        )}

        {screen === 'entry' && (
          <ShoeEntryForm onSearch={handleSearch} />
        )}

        {screen === 'results' && (
          <ResultsPage shoeList={searchList} filters={filters} onReset={handleReset} />
        )}
      </main>
    </div>
  )
}
