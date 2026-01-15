"use client"

import { useState, useMemo } from "react"
import { CreditCard, Lock, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js"
import { useRouter } from "next/navigation"
import type { StripeCardNumberElementChangeEvent } from "@stripe/stripe-js"
import type { PersonalInfo, AddressInfo } from "@/app/titanchef/page"
import { sendGAEvent } from "@next/third-parties/google"

const ORDER_BUMP_PRODUCT = {
  id: "bump-churrasco-titanchef",
  name: "Titanchef: O Código da Carne - Manual de Cortes, Temperos e Facas",
  price: 24.9,
  originalPrice: 49.9,
  image: "https://mk6n6kinhajxg1fp.public.blob.vercel-storage.com/kat/Imagem%20orderbump.png",
}

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

export function TitanchefPaymentForm({ visible, totalAmount, personalInfo, addressInfo }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [cardholderName, setCardholderName] = useState("")
  const [parcelas, setParcelas] = useState("1")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [detectedBrand, setDetectedBrand] = useState<string | null>(null)
  const [cardNumberError, setCardNumberError] = useState<string | null>(null)
  const [isBumpSelected, setIsBumpSelected] = useState(false)

  const SHOW_ORDER_BUMP = false

  const finalTotal = isBumpSelected && SHOW_ORDER_BUMP ? totalAmount + ORDER_BUMP_PRODUCT.price : totalAmount

  const handleCardNumberChange = (event: StripeCardNumberElementChangeEvent) => {
    setDetectedBrand(event.brand !== "unknown" ? event.brand : null)
    if (event.error) {
      setCardNumberError(event.error.message)
    } else {
      setCardNumberError(null)
    }
  }

  const installmentOptions = useMemo(() => {
    const options = []
    for (let i = 1; i <= 12; i++) {
      const installmentValue = finalTotal / i
      options.push({
        value: String(i),
        label: `${i} x R$ ${installmentValue.toFixed(2).replace(".", ",")}`,
      })
    }
    return options
  }, [finalTotal])

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
    setIsProcessing(true)
    setPaymentError(null)

    sendGAEvent("event", "add_payment_info", {
      payment_type: "pix",
      currency: "BRL",
      value: finalTotal,
    })

    try {
      if (!personalInfo.nome || !personalInfo.email) {
        setPaymentError("Por favor, preencha todos os dados pessoais antes de continuar")
        setIsProcessing(false)
        return
      }

      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalTotal,
          paymentMethodType: "pix",
          billingDetails: {
            name: personalInfo.nome,
            email: personalInfo.email,
            tax_id: personalInfo.cpf?.replace(/\D/g, "") || undefined,
          },
          customer_name: personalInfo.nome,
          customer_email: personalInfo.email,
          address: {
            street: `${addressInfo.endereco}, ${addressInfo.numero}${addressInfo.complemento ? ` - ${addressInfo.complemento}` : ""}`,
            city: addressInfo.cidade,
            state: addressInfo.estado,
            cep: addressInfo.cep,
          },
          offer_id: "2",
        }),
      })

      const data = await response.json()

      if (data.error) {
        setPaymentError(data.error)
        setIsProcessing(false)
        return
      }

      if (data.success && data.pixData) {
        const params = new URLSearchParams({
          code: data.pixData.code,
          qr: data.pixData.qrCodeUrl,
          amount: finalTotal.toString(),
          expires: data.pixData.expiresAt.toString(),
          pi: data.paymentIntentId,
          name: personalInfo.nome,
          email: personalInfo.email,
          phone: personalInfo.celular || "",
          address: `${addressInfo.endereco}, ${addressInfo.numero}${addressInfo.complemento ? ` - ${addressInfo.complemento}` : ""}`,
          city: addressInfo.cidade,
          state: addressInfo.estado,
          cep: addressInfo.cep,
        })
        router.push(`/titanchef-pix-payment?${params.toString()}`)
      } else {
        setPaymentError("Erro ao gerar código PIX")
        setIsProcessing(false)
      }
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

    sendGAEvent("event", "add_payment_info", {
      payment_type: "card",
      currency: "BRL",
      value: finalTotal,
    })

    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalTotal,
          paymentMethodType: "card",
          customer_name: personalInfo.nome,
          customer_email: personalInfo.email,
          customer_cpf: personalInfo.cpf?.replace(/\D/g, ""),
          address: {
            street: `${addressInfo.endereco}, ${addressInfo.numero}${addressInfo.complemento ? ` - ${addressInfo.complemento}` : ""}`,
            city: addressInfo.cidade,
            state: addressInfo.estado,
            cep: addressInfo.cep,
          },
          offer_id: "2",
        }),
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
        const successParams = new URLSearchParams({
          name: personalInfo.nome,
          email: personalInfo.email,
          phone: personalInfo.celular || "",
          address: `${addressInfo.endereco}, ${addressInfo.numero}${addressInfo.complemento ? ` - ${addressInfo.complemento}` : ""}`,
          city: addressInfo.cidade,
          state: addressInfo.estado,
          cep: addressInfo.cep,
          method: "card",
          amount: finalTotal.toString(),
        })
        router.push(`/titanchef-success?${successParams.toString()}`)
      }
    } catch (err) {
      setPaymentError("Erro ao processar pagamento")
    } finally {
      setIsProcessing(false)
    }
  }

  const OrderBumpCard = () => (
    <div className="bg-yellow-50 border-2 border-dashed border-yellow-400 rounded-lg p-4 mb-4">
      <p className="text-xs text-gray-600 mb-3 font-medium">Parabéns, você ganhou 50% de desconto!</p>
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-20 flex-shrink-0">
          <Image
            src={ORDER_BUMP_PRODUCT.image || "/placeholder.svg"}
            alt={ORDER_BUMP_PRODUCT.name}
            fill
            className="object-cover rounded"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 leading-tight">{ORDER_BUMP_PRODUCT.name}</h4>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-400 line-through">
              R$ {ORDER_BUMP_PRODUCT.originalPrice.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-sm font-bold text-green-600">
              R$ {ORDER_BUMP_PRODUCT.price.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsBumpSelected(!isBumpSelected)
          }}
          className={cn(
            "flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors",
            isBumpSelected ? "bg-green-500 text-white" : "bg-red-500 hover:bg-red-600 text-white",
          )}
        >
          {isBumpSelected ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              ADICIONADO
            </span>
          ) : (
            "LEVAR JUNTO"
          )}
        </button>
      </div>
    </div>
  )

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

              {SHOW_ORDER_BUMP && (
                <div className="mt-4">
                  <OrderBumpCard />
                </div>
              )}

              <button
                onClick={handlePixPayment}
                disabled={isProcessing || !stripe}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    PAGAR <span className="text-green-200">R$ {finalTotal.toFixed(2).replace(".", ",")}</span>
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  {installmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {SHOW_ORDER_BUMP && (
                <div className="mt-4">
                  <OrderBumpCard />
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleCardPayment}
                disabled={isProcessing || !stripe}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    PAGAR{" "}
                    <span className="text-green-200">
                      {selectedInstallment?.label || `R$ ${finalTotal.toFixed(2).replace(".", ",")}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Badge */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
        <Lock className="h-4 w-4" />
        <span>Seus dados estão protegidos com criptografia SSL</span>
      </div>
    </div>
  )
}
