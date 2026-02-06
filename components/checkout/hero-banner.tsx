import Image from "next/image"

const DEFAULT_BANNER = "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/RD/Oferta%201.png"

interface HeroBannerProps {
  src?: string
  alt?: string
}

export function HeroBanner({ src = DEFAULT_BANNER, alt = "Rosas do Deserto - Jardim da Cida" }: HeroBannerProps) {
  return (
    <div className="overflow-hidden rounded-lg">
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={400}
        className="w-full h-auto object-cover"
        priority
        unoptimized
      />
    </div>
  )
}
