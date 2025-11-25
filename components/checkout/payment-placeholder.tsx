"use client"

import { CreditCard, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaymentPlaceholderProps {
  visible: boolean
}

export function PaymentPlaceholder({ visible }: PaymentPlaceholderProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg p-6 shadow-sm transition-all duration-300",
        !visible && "opacity-50 pointer-events-none",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <CreditCard className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Pagamento</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {visible ? "Selecione sua forma de pagamento preferida." : "Preencha as informações acima para continuar."}
          </p>
        </div>
      </div>

      {/* Stripe Placeholder or Locked State */}
      {visible ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50">
          <CreditCard className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Stripe PaymentElement será injetado aqui</p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-100">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Complete as etapas anteriores para desbloquear</p>
        </div>
      )}
    </div>
  )
}
