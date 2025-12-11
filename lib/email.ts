import { Resend } from "resend"
import { OrderConfirmationEmail } from "@/components/emails/order-confirmation"

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendOrderConfirmationParams {
  to: string
  customerName: string
  orderId: string
  amount: number
  paymentMethod: string
  products?: Array<{
    name: string
    quantity: number
    price: number
  }>
  address?: {
    street: string
    city: string
    state: string
    cep: string
  }
}

export async function sendOrderConfirmation({
  to,
  customerName,
  orderId,
  amount,
  paymentMethod,
  products = [],
  address,
}: SendOrderConfirmationParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: "Katuchef <naoresponda@katucheftitanio.com>",
      to: [to],
      subject: `Pedido Confirmado! #${orderId}`,
      react: OrderConfirmationEmail({
        customerName,
        orderId,
        amount,
        paymentMethod,
        products,
        address,
      }),
    })

    if (error) {
      console.error("Error sending email:", error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error sending order confirmation email:", error)
    return { success: false, error }
  }
}
