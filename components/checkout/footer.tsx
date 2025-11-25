import Image from "next/image"

const paymentMethods = [
  {
    name: "Mastercard",
    color: "#EB001B",
    logo: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-mastercard.svg",
  },
  {
    name: "Visa",
    color: "#1A1F71",
    logo: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-visa.svg",
  },
  {
    name: "Amex",
    color: "#006FCF",
    logo: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/amex.Csr7hRoy.svg",
  },
  {
    name: "Discover",
    color: "#FF6000",
    logo: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-discover.svg",
  },
  {
    name: "Pix",
    color: "#32BCAD",
    logo: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-pix.svg",
  },
]

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-8">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Payment Methods */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-4">Formas de pagamento</p>
          <div className="flex items-center justify-center gap-4">
            {paymentMethods.map((method, index) => (
              <Image
                key={index}
                src={method.logo || "/placeholder.svg"}
                alt={method.name}
                width={40}
                height={28}
                className="h-7 w-auto object-contain"
                unoptimized
              />
            ))}
          </div>
        </div>

        {/* Company Info */}
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-gray-900">Katuchef</p>
          <p className="text-xs text-gray-500">info@katucheftitanio.com</p>
        </div>

        {/* Legal Links */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
          <a href="#" className="hover:text-gray-700 transition-colors">
            Termos de Uso
          </a>
          <span className="text-gray-300">|</span>
          <a href="#" className="hover:text-gray-700 transition-colors">
            Trocas e Devoluções
          </a>
          <span className="text-gray-300">|</span>
          <a href="#" className="hover:text-gray-700 transition-colors">
            Política de Privacidade
          </a>
        </div>
      </div>
    </footer>
  )
}
