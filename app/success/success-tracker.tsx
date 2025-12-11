"use client"

import { useEffect, useId } from "react"
import { HybridTracker } from "@/components/hybrid-tracker"
import { sendGAEvent } from "@next/third-parties/google"

interface SuccessTrackerProps {
  value: number
  paymentMethod: string
}

export function SuccessTracker({ value, paymentMethod }: SuccessTrackerProps) {
  const transactionId = useId()

  useEffect(() => {
    sendGAEvent("event", "purchase", {
      transaction_id: transactionId,
      value: value,
      currency: "BRL",
      payment_type: paymentMethod,
    })
  }, [transactionId, value, paymentMethod])

  return (
    <HybridTracker
      event="Purchase"
      data={{
        value,
        currency: "BRL",
        content_type: "product",
        payment_method: paymentMethod,
      }}
    />
  )
}
