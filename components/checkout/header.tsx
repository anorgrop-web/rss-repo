import { ShoppingCart } from "lucide-react"

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center">
          <span className="text-lg font-bold text-green-700">Jardim da Cida</span>
        </div>

        {/* Cart Icon */}
        <button className="relative p-2">
          <ShoppingCart className="h-6 w-6 text-gray-700" />
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            1
          </span>
        </button>
      </div>
    </header>
  )
}
