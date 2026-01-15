import { NextResponse } from "next/server"
import Stripe from "stripe"
import { sendOrderConfirmation } from "@/lib/email"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

function detectBrandFromOfferId(offerId: string | undefined): "katuchef" | "titanchef" {
  // offer_id "2" = titanchef, qualquer outro = katuchef (padrão)
  return offerId === "2" ? "titanchef" : "katuchef"
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error(`Webhook signature verification failed: ${errorMessage}`)
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 })
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const metadata = paymentIntent.metadata

      console.log(`PaymentIntent ${paymentIntent.id} succeeded`)

      // Extract customer info from metadata
      const customerEmail = metadata.customer_email
      const customerName = metadata.customer_name
      const paymentMethod = metadata.payment_method || "pix"
      const addressStreet = metadata.address_street
      const addressCity = metadata.address_city
      const addressState = metadata.address_state
      const addressCep = metadata.address_cep
      const offerId = metadata.oid

      const brand = detectBrandFromOfferId(offerId)

      if (customerEmail && customerName) {
        // Build address object if available
        const address = addressStreet
          ? {
              street: addressStreet,
              city: addressCity || "",
              state: addressState || "",
              cep: addressCep || "",
            }
          : undefined

        // Send order confirmation email
        const emailResult = await sendOrderConfirmation({
          to: customerEmail,
          customerName,
          orderId: paymentIntent.id.slice(-8).toUpperCase(),
          amount: paymentIntent.amount / 100,
          paymentMethod,
          products: [], // Produtos removidos dos metadados
          address,
          brand, // Identificador da marca para emails (detectado automaticamente)
        })

        if (emailResult.success) {
          console.log(`Order confirmation email sent to ${customerEmail} (brand: ${brand})`)
        } else {
          console.error(`Failed to send email to ${customerEmail}:`, emailResult.error)
        }
      } else {
        console.warn("Missing customer email or name in payment metadata")
      }

      break
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.log(`PaymentIntent ${paymentIntent.id} failed`)
      break
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
