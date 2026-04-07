export default function OnboardingScreen({ onStart }) {
  return (
    <div className="w-full max-w-xl mx-auto px-4">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Find the best UK price for your Court Shoe Finder results
        </h2>
        <p className="text-gray-500 text-sm">
          We search 40+ UK and EU retailers and calculate the true landed cost — including shipping and import tax.
        </p>
      </div>

      {/* Two-step flow */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
        {/* Step 1 */}
        <div className="flex-1 w-full bg-white border border-gray-200 rounded-xl p-5 text-center shadow-sm">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">
            1
          </div>
          <p className="font-semibold text-gray-800 mb-1">Visit Court Shoe Finder</p>
          <p className="text-xs text-gray-500">
            Answer the quiz at courtshoefinder.com and note down your recommended shoes and their match scores.
          </p>
        </div>

        {/* Arrow */}
        <div className="text-gray-300 text-2xl font-light hidden sm:block">→</div>
        <div className="text-gray-300 text-2xl font-light sm:hidden">↓</div>

        {/* Step 2 */}
        <div className="flex-1 w-full bg-white border border-blue-200 rounded-xl p-5 text-center shadow-sm">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">
            2
          </div>
          <p className="font-semibold text-gray-800 mb-1">Enter your results here</p>
          <p className="text-xs text-gray-500">
            We search every major tennis retailer and rank results by true GBP landed cost.
          </p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <a
          href="https://courtshoefinder.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg text-center hover:bg-blue-50 transition-colors text-sm"
        >
          Open Court Shoe Finder
        </a>
        <button
          onClick={onStart}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          I have my results — let's go
        </button>
      </div>
    </div>
  )
}
