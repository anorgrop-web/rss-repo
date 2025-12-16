import Stripe from "stripe"
import { NextResponse } from "next/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
})

async function getOrCreateCustomer(
  email: string,
  name: string,
  address?: {
    street?: string
    city?: string
    state?: string
    cep?: string
  },
): Promise<string> {
  // Check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email: email,
    limit: 1,
  })

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    address: address
      ? {
          line1: address.street || "",
          city: address.city || "",
          state: address.state || "",
          postal_code: address.cep?.replace(/\D/g, "") || "",
          country: "BR",
        }
      : undefined,
  })

  return customer.id
}

async function addTaxIdToCustomer(customerId: string, cpf: string): Promise<void> {
  const normalizedCpf = cpf.replace(/\D/g, "")

  try {
    const existingTaxIds = await stripe.customers.listTaxIds(customerId, { limit: 100 })
    const cpfExists = existingTaxIds.data.some((taxId) => {
      if (taxId.type !== "br_cpf") return false
      const existingCpf = taxId.value.replace(/\D/g, "")
      return existingCpf === normalizedCpf
    })

    if (cpfExists) {
      return // Tax ID already exists, no need to add
    }

    await stripe.customers.createTaxId(customerId, {
      type: "br_cpf",
      value: normalizedCpf,
    })
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      if (error.code === "tax_id_already_exists" || error.code === "resource_already_exists") {
        return // Expected error, ignore silently
      }
    }
    // Log other errors but don't fail the payment
    console.warn("Warning: Could not add Tax ID to customer:", error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      amount,
      paymentMethodType,
      billingDetails,
      customer_name,
      customer_email,
      customer_cpf,
      address,
      products,
    } = body

    const amountInCents = Math.round(amount * 100)

    const metadata: Record<string, string> = {}
    if (customer_name) metadata.customer_name = customer_name
    if (customer_email) metadata.customer_email = customer_email
    if (address) {
      metadata.address_street = address.street || ""
      metadata.address_city = address.city || ""
      metadata.address_state = address.state || ""
      metadata.address_cep = address.cep || ""
    }
    if (products) {
      metadata.products = JSON.stringify(products)
    }
    metadata.payment_method = paymentMethodType

    let customerId: string | undefined
    if (customer_email && customer_name) {
      customerId = await getOrCreateCustomer(customer_email, customer_name, address)

      // Add CPF as Tax ID if provided (from frontend or billingDetails)
      const cpf = customer_cpf || billingDetails?.tax_id
      if (cpf && customerId) {
        await addTaxIdToCustomer(customerId, cpf.replace(/\D/g, ""))
      }
    }

    if (paymentMethodType === "pix") {
      // Create PaymentMethod on the server
      const paymentMethod = await stripe.paymentMethods.create({
        type: "pix",
        billing_details: {
          name: billingDetails.name,
          email: billingDetails.email,
          tax_id: billingDetails.tax_id || undefined,
        },
      })

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "brl",
        payment_method_types: ["pix"],
        payment_method: paymentMethod.id,
        confirm: true,
        customer: customerId,
        metadata,
        payment_method_options: {
          pix: {
            expires_after_seconds: 1800, // 30 minutes
            // @ts-expect-error - amount_includes_iof is a valid parameter but not in types yet
            amount_includes_iof: "always",
          },
        },
      })

      // Extract PIX data from next_action
      const pixData = paymentIntent.next_action?.pix_display_qr_code

      if (!pixData) {
        return NextResponse.json({ error: "Failed to generate PIX QR code" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        pixData: {
          code: pixData.data,
          qrCodeUrl: pixData.image_url_png,
          expiresAt: pixData.expires_at,
          hostedUrl: pixData.hosted_instructions_url,
        },
      })
    } else {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "brl",
        payment_method_types: ["card"],
        customer: customerId,
        metadata,
      })

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      })
    }
  } catch (error) {
    console.error("Error creating payment intent:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to create payment intent"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
