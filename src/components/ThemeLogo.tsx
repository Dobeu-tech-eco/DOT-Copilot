import { Truck } from 'lucide-react'
import { useTheme } from './ThemeProvider'

interface ThemeLogoProps {
  className: string
  iconSize: number
}

export function ThemeLogo({ className, iconSize }: ThemeLogoProps) {
  const { displayName, logoUrl } = useTheme()

  return (
    <div className={`${className} bg-brand-500 flex items-center justify-center overflow-hidden shrink-0`}>
      {logoUrl ? (
        <img src={logoUrl} alt={`${displayName} logo`} className="w-full h-full object-contain bg-white p-1" />
      ) : (
        <Truck size={iconSize} className="text-white" />
      )}
    </div>
  )
}
