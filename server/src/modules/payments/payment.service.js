// server/src/modules/payments/payment.service.js
const db = require('../../config/database');
const environment = require('../../config/environment'); 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || environment.stripeSecretKey); 

class PaymentService {
  async createOrRetrievePaymentIntent(orderId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1;', [orderId]);
      if (orderResult.rows.length === 0) {
        throw { statusCode: 404, message: 'Order not found.' };
      }
      const order = orderResult.rows[0];

      if (order.user_id !== userId) {
        throw { statusCode: 403, message: 'You are not authorized to process payment for this order.' };
      }

      if (order.order_status !== 'pending_payment') {
        if (order.payment_intent_id && ['confirmed', 'processing', 'shipped', 'completed'].includes(order.order_status)) {
             throw { statusCode: 400, message: `Order is already in status '${order.order_status}' and likely paid.` };
        }
        if (!['payment_failed', 'cancelled_by_user', 'cancelled_by_admin'].includes(order.order_status)) {
            throw { statusCode: 400, message: `Order status is '${order.order_status}'. Payment cannot be processed.` };
        }
      }
      
      const orderTotalInCents = Math.round(parseFloat(order.order_total) * 100);

      if (order.payment_intent_id) {
        try {
          const existingPI = await stripe.paymentIntents.retrieve(order.payment_intent_id);
          if (['requires_payment_method', 'requires_action', 'requires_confirmation'].includes(existingPI.status)) {
             if (existingPI.amount !== orderTotalInCents) {
                // If amount changed, Stripe generally requires a new PaymentIntent.
                // For simplicity, we will create a new one in this case.
                console.warn(`Order total (${orderTotalInCents}) differs from existing PaymentIntent amount (${existingPI.amount}). A new PI will be created.`);
                await client.query('UPDATE orders SET payment_intent_id = NULL, payment_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [orderId]);
                // Fall through to create a new PI
             } else {
                await client.query('COMMIT');
                return { clientSecret: existingPI.client_secret, paymentIntentId: existingPI.id, existing: true };
             }
          } else if (existingPI.status === 'succeeded') {
            throw { statusCode: 400, message: 'This order has already been paid.' };
          } else { 
            console.log(`Existing PaymentIntent ${order.payment_intent_id} status is ${existingPI.status}. Creating a new one.`);
            await client.query('UPDATE orders SET payment_intent_id = NULL, payment_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [orderId]);
          }
        } catch (stripeError) {
          console.error(`Error retrieving/handling existing PI ${order.payment_intent_id}:`, stripeError.message);
          await client.query('UPDATE orders SET payment_intent_id = NULL, payment_status = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [orderId]);
        }
      }

      const paymentIntentParams = {
        amount: orderTotalInCents,
        currency: 'usd', 
        payment_method_types: ['card'],
        metadata: { order_id: order.id, order_number: order.order_number },
      };

      const newPaymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      await client.query(
        'UPDATE orders SET payment_intent_id = $1, payment_gateway = $2, payment_status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4;',
        [newPaymentIntent.id, 'stripe', newPaymentIntent.status, orderId]
      );

      await client.query('COMMIT');
      return { clientSecret: newPaymentIntent.client_secret, paymentIntentId: newPaymentIntent.id, existing: false };

    } catch (error) {
      await client.query('ROLLBACK');
      if (error.statusCode) throw error; 
      if (error.type && error.type.startsWith('Stripe')) {
           throw { statusCode: 400, message: `Stripe Error: ${error.message}` };
      }
      console.error('Error in createOrRetrievePaymentIntent service:', error);
      throw { statusCode: 500, message: 'Failed to create or retrieve PaymentIntent.' };
    } finally {
      client.release();
    }
  }

  async handleStripeWebhook(rawBody, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || environment.stripeWebhookSecret;
    if (!webhookSecret) {
        console.error("Stripe webhook secret is not configured.");
        throw { statusCode: 500, message: "Webhook secret configuration error." };
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error(`⚠️  Webhook signature verification failed: ${err.message}`);
      throw { statusCode: 400, message: `Webhook Error: ${err.message}` };
    }

    console.log('Received Stripe event:', event.type, event.id);
    const client = await db.pool.connect(); // Use a DB client for potential transactions

    try {
      await client.query('BEGIN');
      let order;
      let paymentIntent;

      switch (event.type) {
        case 'payment_intent.succeeded':
          paymentIntent = event.data.object;
          console.log(`PaymentIntent ${paymentIntent.id} succeeded.`);
          
          // Find order by payment_intent_id or metadata.order_id
          const orderResultSucceeded = await client.query(
            'SELECT * FROM orders WHERE payment_intent_id = $1 OR id = $2;', 
            [paymentIntent.id, paymentIntent.metadata.order_id]
          );
          order = orderResultSucceeded.rows[0];

          if (order) {
            if (order.order_status === 'confirmed' || order.order_status === 'processing' || order.order_status === 'shipped' || order.order_status === 'completed') {
              console.log(`Order ${order.id} already processed for PI ${paymentIntent.id}. Idempotency check passed.`);
            } else {
              await client.query(
                "UPDATE orders SET order_status = 'confirmed', payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                [paymentIntent.status, order.id]
              );
              console.log(`Order ${order.id} status updated to 'confirmed' based on PI Succeeded.`);
              // TODO: Trigger further actions: email notification, inventory deduction, fulfillment process
            }
          } else {
            console.warn(`Order not found for successful PaymentIntent ${paymentIntent.id} (metadata.order_id: ${paymentIntent.metadata.order_id})`);
          }
          break;

        case 'payment_intent.payment_failed':
          paymentIntent = event.data.object;
          console.log(`PaymentIntent ${paymentIntent.id} failed. Reason: ${paymentIntent.last_payment_error?.message}`);
          
          const orderResultFailed = await client.query(
            'SELECT * FROM orders WHERE payment_intent_id = $1 OR id = $2;', 
            [paymentIntent.id, paymentIntent.metadata.order_id]
          );
          order = orderResultFailed.rows[0];

          if (order) {
            // Only update if it's not already in a final success state
            if (order.order_status !== 'confirmed' && order.order_status !== 'processing' && order.order_status !== 'shipped' && order.order_status !== 'completed') {
                await client.query(
                    "UPDATE orders SET order_status = 'payment_failed', payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;",
                    [paymentIntent.status, order.id] // paymentIntent.status would be 'requires_payment_method' or similar after failure
                );
                console.log(`Order ${order.id} status updated to 'payment_failed'.`);
                // TODO: Trigger notification to user about payment failure
            }
          } else {
            console.warn(`Order not found for failed PaymentIntent ${paymentIntent.id} (metadata.order_id: ${paymentIntent.metadata.order_id})`);
          }
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error processing webhook event:', err);
      // Do not throw error that Stripe would retry for internal DB issues unless specifically designed
      // For now, if DB fails, it's an internal error, Stripe will retry if we don't send 200.
      // If we send 200, Stripe stops. If we send 500, Stripe retries.
      // For critical errors, it's better to let Stripe retry.
      throw { statusCode: 500, message: "Internal server error processing webhook."};
    } finally {
        client.release();
    }
    return { received: true };
  }
}

module.exports = new PaymentService();
