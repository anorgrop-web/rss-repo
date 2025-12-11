import Stripe from "stripe"
import { NextResponse } from "next/server"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
})

const ADMIN_PASSWORD = "Senhacheckout1!"

export async function GET(request: Request) {
  // Validate admin password
  const adminPassword = request.headers.get("x-admin-password")
  if (adminPassword !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Convert dates to Unix timestamps
    const startTimestamp = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined
    const endTimestamp = endDate ? Math.floor(new Date(endDate + "T23:59:59").getTime() / 1000) : undefined

    // Fetch all payment intents within the date range
    const paymentIntents: Stripe.PaymentIntent[] = []
    let hasMore = true
    let startingAfter: string | undefined = undefined

    while (hasMore) {
      const response = await stripe.paymentIntents.list({
        created: {
          ...(startTimestamp && { gte: startTimestamp }),
          ...(endTimestamp && { lte: endTimestamp }),
        },
        limit: 100,
        starting_after: startingAfter,
      })

      paymentIntents.push(...response.data)
      hasMore = response.has_more
      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id
      }
    }

    // Initialize stats
    let pixGeneratedQtd = 0
    let pixGeneratedValue = 0
    let pixPaidQtd = 0
    let pixPaidValue = 0
    let totalRevenue = 0

    // Recent PIX orders (last 10)
    const recentPixOrders: Array<{
      id: string
      amount: number
      status: string
      created: number
      customerName: string
      customerEmail: string
    }> = []

    // Process payment intents
    for (const intent of paymentIntents) {
      const isPix = intent.payment_method_types.includes("pix")
      const amountInReais = intent.amount / 100

      if (isPix) {
        pixGeneratedQtd++
        pixGeneratedValue += amountInReais

        if (intent.status === "succeeded") {
          pixPaidQtd++
          pixPaidValue += amountInReais
        }

        // Add to recent orders
        recentPixOrders.push({
          id: intent.id,
          amount: amountInReais,
          status: intent.status,
          created: intent.created,
          customerName: intent.metadata?.customer_name || "N/A",
          customerEmail: intent.metadata?.customer_email || "N/A",
        })
      }

      // Calculate total revenue (all succeeded payments)
      if (intent.status === "succeeded") {
        totalRevenue += amountInReais
      }
    }

    // Calculate conversion rate
    const pixConversionRate = pixGeneratedQtd > 0 ? (pixPaidQtd / pixGeneratedQtd) * 100 : 0

    // Sort recent orders by created date (newest first) and take top 10
    recentPixOrders.sort((a, b) => b.created - a.created)
    const top10RecentOrders = recentPixOrders.slice(0, 10)

    return NextResponse.json({
      pixGeneratedQtd,
      pixGeneratedValue,
      pixPaidQtd,
      pixPaidValue,
      pixConversionRate,
      totalRevenue,
      recentPixOrders: top10RecentOrders,
      totalPaymentIntents: paymentIntents.length,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch stats"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
