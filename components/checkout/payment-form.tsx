"use client"

import { useState, useMemo } from "react"
import { CreditCard, Lock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js"
import type { StripeCardNumberElementChangeEvent } from "@stripe/stripe-js"
import type { PersonalInfo, AddressInfo } from "@/app/page"

interface PaymentFormProps {
  visible: boolean
  totalAmount: number
  personalInfo: PersonalInfo
  addressInfo: AddressInfo
}

type PaymentMethod = "pix" | "credit_card"

const cardBrandLogos: Record<string, string> = {
  visa: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-visa.svg",
  mastercard: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-mastercard.svg",
  amex: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/amex.Csr7hRoy.svg",
  discover: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/Comum%20/card-discover.svg",
}

const acceptedBrands = [
  { id: "visa", name: "Visa" },
  { id: "mastercard", name: "Mastercard" },
  { id: "amex", name: "Amex" },
  { id: "discover", name: "Discover" },
]

const stripeElementStyle = {
  base: {
    fontSize: "16px",
    color: "#111827",
    fontFamily: "system-ui, -apple-system, sans-serif",
    "::placeholder": {
      color: "#9ca3af",
    },
  },
  invalid: {
    color: "#ef4444",
  },
}

export function PaymentForm({ visible, totalAmount, personalInfo, addressInfo }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [cardholderName, setCardholderName] = useState("")
  const [parcelas, setParcelas] = useState("1")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [detectedBrand, setDetectedBrand] = useState<string | null>(null)
  const [cardNumberError, setCardNumberError] = useState<string | null>(null)

  // Handle card number change for brand detection
  const handleCardNumberChange = (event: StripeCardNumberElementChangeEvent) => {
    setDetectedBrand(event.brand !== "unknown" ? event.brand : null)
    if (event.error) {
      setCardNumberError(event.error.message)
    } else {
      setCardNumberError(null)
    }
  }

  // Generate installment options
  const installmentOptions = useMemo(() => {
    const options = []
    for (let i = 1; i <= 12; i++) {
      const installmentValue = totalAmount / i
      options.push({
        value: String(i),
        label: `${i} x R$ ${installmentValue.toFixed(2).replace(".", ",")}`,
      })
    }
    return options
  }, [totalAmount])

  const selectedInstallment = installmentOptions.find((o) => o.value === parcelas)

  const buildBillingDetails = () => ({
    name: personalInfo.nome,
    email: personalInfo.email,
    phone: personalInfo.celular.replace(/\D/g, ""),
    address: {
      line1: `${addressInfo.endereco}, ${addressInfo.numero}`,
      line2: addressInfo.complemento || undefined,
      city: addressInfo.cidade,
      state: addressInfo.estado,
      postal_code: addressInfo.cep.replace(/\D/g, ""),
      country: "BR",
    },
  })

  const handlePixPayment = async () => {
    if (!stripe) return

    setIsProcessing(true)
    setPaymentError(null)

    try {
      // Step 1: Create the Payment Intent
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totalAmount, paymentMethodType: "pix" }),
      })

      const { clientSecret, error } = await response.json()

      if (error) {
        setPaymentError(error)
        setIsProcessing(false)
        return
      }

      const { error: pmError, paymentMethod: pixPaymentMethod } = await stripe.createPaymentMethod({
        type: "pix",
        billing_details: buildBillingDetails(),
      })

      if (pmError) {
        setPaymentError(pmError.message || "Erro ao criar método de pagamento")
        setIsProcessing(false)
        return
      }

      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret,
        confirmParams: {
          payment_method: pixPaymentMethod.id,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/success`,
        },
        redirect: "if_required",
      })

      if (confirmError) {
        setPaymentError(confirmError.message || "Erro ao processar pagamento PIX")
        setIsProcessing(false)
      }
      // If no error, the PIX payment was confirmed and QR code will be displayed
    } catch (err) {
      console.error("Erro PIX:", err)
      setPaymentError("Erro ao processar pagamento")
      setIsProcessing(false)
    }
  }

  const handleCardPayment = async () => {
    if (!stripe || !elements) return

    const cardNumberElement = elements.getElement(CardNumberElement)
    if (!cardNumberElement) return

    setIsProcessing(true)
    setPaymentError(null)

    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totalAmount, paymentMethodType: "card" }),
      })

      const { clientSecret, error } = await response.json()

      if (error) {
        setPaymentError(error)
        setIsProcessing(false)
        return
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            ...buildBillingDetails(),
            name: cardholderName || personalInfo.nome,
          },
        },
      })

      if (confirmError) {
        setPaymentError(confirmError.message || "Erro ao processar pagamento")
      } else if (paymentIntent?.status === "succeeded") {
        window.location.href = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/success`
      }
    } catch (err) {
      setPaymentError("Erro ao processar pagamento")
    } finally {
      setIsProcessing(false)
    }
  }

  if (!visible) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm opacity-50 pointer-events-none">
        <div className="flex items-start gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <CreditCard className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Formas de Pagamento</h2>
            <p className="text-xs text-gray-500 mt-0.5">Preencha as informações acima para continuar.</p>
          </div>
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-100">
          <Lock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Complete as etapas anteriores para desbloquear</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <CreditCard className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Formas de Pagamento</h2>
          <p className="text-xs text-gray-500 mt-0.5">Para finalizar seu pedido escolha uma forma de pagamento</p>
        </div>
      </div>

      {/* Payment Error */}
      {paymentError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{paymentError}</div>
      )}

      {/* Payment Options */}
      <div className="space-y-4">
        {/* PIX Option */}
        <div
          className={cn(
            "border rounded-lg p-4 cursor-pointer transition-all",
            paymentMethod === "pix" ? "border-green-500 bg-white" : "border-gray-200 bg-gray-50",
          )}
          onClick={() => setPaymentMethod("pix")}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                paymentMethod === "pix" ? "border-green-500" : "border-gray-300",
              )}
            >
              {paymentMethod === "pix" && <div className="w-3 h-3 rounded-full bg-green-500" />}
            </div>
            <span className="font-semibold text-gray-900">PIX</span>
          </div>

          {paymentMethod === "pix" && (
            <div className="mt-4 pl-8">
              <p className="text-sm font-semibold text-gray-700">Atente-se aos detalhes:</p>
              <p className="text-sm text-gray-600 mt-1">
                Pagamentos via pix são confirmados imediatamente. Você não precisa ter uma chave pix para efetuar o
                pagamento, basta ter o app do seu banco em seu celular.
              </p>

              <button
                onClick={handlePixPayment}
                disabled={isProcessing || !stripe}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    PAGAR <span className="text-green-200">R$ {totalAmount.toFixed(2).replace(".", ",")}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Credit Card Option */}
        <div
          className={cn(
            "border rounded-lg p-4 cursor-pointer transition-all",
            paymentMethod === "credit_card" ? "border-green-500 bg-white" : "border-gray-200 bg-gray-50",
          )}
          onClick={() => setPaymentMethod("credit_card")}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                paymentMethod === "credit_card" ? "border-green-500" : "border-gray-300",
              )}
            >
              {paymentMethod === "credit_card" && <div className="w-3 h-3 rounded-full bg-green-500" />}
            </div>
            <span className="font-semibold text-gray-900">CARTÃO DE CRÉDITO</span>
          </div>

          {paymentMethod === "credit_card" && (
            <div className="mt-4 pl-0 md:pl-8">
              {/* Accepted Card Brands */}
              <div className="flex flex-wrap gap-2 mb-6">
                {acceptedBrands.map((brand) => (
                  <div
                    key={brand.id}
                    className="h-8 w-12 bg-gray-100 rounded flex items-center justify-center overflow-hidden"
                  >
                    {cardBrandLogos[brand.id] ? (
                      <Image
                        src={cardBrandLogos[brand.id] || "/placeholder.svg"}
                        alt={brand.name}
                        width={40}
                        height={24}
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="text-[8px] text-gray-500">{brand.name}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Cardholder Name */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">Nome igual consta em seu cartão</label>
                <input
                  type="text"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder=""
                />
              </div>

              {/* Card Number - Stripe Element */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">Número do Cartão</label>
                <div className="relative">
                  <div
                    className={cn(
                      "w-full border rounded-lg px-4 py-3 pr-14",
                      cardNumberError ? "border-red-400 bg-red-50" : "border-gray-300",
                    )}
                  >
                    <CardNumberElement
                      options={{ style: stripeElementStyle, showIcon: false }}
                      onChange={handleCardNumberChange}
                    />
                  </div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-6 flex items-center justify-center">
                    {detectedBrand && cardBrandLogos[detectedBrand] ? (
                      <Image
                        src={cardBrandLogos[detectedBrand] || "/placeholder.svg"}
                        alt={detectedBrand}
                        width={32}
                        height={20}
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <CreditCard className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                </div>
                {cardNumberError && <p className="text-sm text-red-500 mt-1">{cardNumberError}</p>}
              </div>

              {/* Expiry and CVV - Stripe Elements */}
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Validade:</label>
                    <div className="border border-gray-300 rounded-lg px-4 py-3">
                      <CardExpiryElement options={{ style: stripeElementStyle }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">CVV:</label>
                    <div className="border border-gray-300 rounded-lg px-4 py-3">
                      <CardCvcElement options={{ style: stripeElementStyle }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Installments */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">Parcelas</label>
                <select
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  {installmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pay Button */}
              <button
                onClick={handleCardPayment}
                disabled={isProcessing || !stripe || !elements}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    PAGAR <span className="text-green-200">{selectedInstallment?.label}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
