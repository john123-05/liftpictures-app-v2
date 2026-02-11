import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('No stripe-signature header found');
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body as ArrayBuffer then convert to string
    // This ensures we preserve the exact bytes that Stripe signed
    const rawBody = await req.arrayBuffer();
    const bodyText = new TextDecoder().decode(rawBody);

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(bodyText, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    await handleEvent(event);

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  console.info(`[${event.id}] Processing event: ${event.type}`);

  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    console.info(`[${event.id}] No data in event`);
    return;
  }

  if (!('customer' in stripeData)) {
    console.info(`[${event.id}] No customer in event data`);
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    console.info(`[${event.id}] Skipping standalone payment_intent (no invoice)`);
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`[${event.id}] No customer received on event`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`[${event.id}] Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`[${event.id}] Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
          metadata,
        } = stripeData as Stripe.Checkout.Session;

        console.info(`[${event.id}] Processing payment for session: ${checkout_session_id}`);

        // Check for idempotency - if purchase already exists for this session, skip
        const { data: existingPurchase } = await supabase
          .from('purchases')
          .select('id')
          .eq('stripe_checkout_session_id', checkout_session_id)
          .maybeSingle();

        if (existingPurchase) {
          console.info(`[${event.id}] Purchase already processed for session: ${checkout_session_id}`);
          return;
        }

        // Get user_id from customer mapping
        const { data: customerData, error: customerError } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (customerError) {
          console.error(`[${event.id}] Error fetching customer:`, customerError);
          throw customerError;
        }

        if (!customerData?.user_id) {
          console.error(`[${event.id}] No user found for customer: ${customerId}`);
          return;
        }

        const userId = customerData.user_id;
        console.info(`[${event.id}] Found user: ${userId}`);

        // Parse cart items from metadata
        const cartItems = metadata?.cart_items ? JSON.parse(metadata.cart_items) : [];
        console.info(`[${event.id}] Cart items: ${cartItems.length}`);

        if (cartItems.length === 0) {
          console.error(`[${event.id}] No cart items in metadata`);
          return;
        }

        // Create purchase record with first photo (schema requires photo_id NOT NULL)
        const firstPhotoId = cartItems[0].photoId;
        const { data: purchase, error: purchaseError } = await supabase
          .from('purchases')
          .insert({
            user_id: userId,
            photo_id: firstPhotoId,
            stripe_checkout_session_id: checkout_session_id,
            stripe_payment_intent_id: payment_intent as string,
            amount_cents: amount_total,
            currency,
            paid_at: new Date().toISOString(),
            status: 'paid',
            total_amount_cents: amount_total,
          })
          .select()
          .single();

        if (purchaseError) {
          console.error(`[${event.id}] Error creating purchase:`, purchaseError);
          throw purchaseError;
        }

        if (!purchase) {
          console.error(`[${event.id}] No purchase returned`);
          return;
        }

        console.info(`[${event.id}] Created purchase: ${purchase.id}`);

        // Create purchase items and unlock photos
        let unlockedCount = 0;
        for (const item of cartItems) {
          if (item.type === 'photo' && item.photoId) {
            console.info(`[${event.id}] Processing photo: ${item.photoId}`);

            // Create purchase item
            const { error: purchaseItemError } = await supabase
              .from('purchase_items')
              .insert({
                purchase_id: purchase.id,
                item_type: 'photo',
                photo_id: item.photoId,
                unit_amount_cents: Math.round(item.price * 100),
                quantity: item.quantity || 1,
              });

            if (purchaseItemError) {
              console.error(`[${event.id}] Error creating purchase_item:`, purchaseItemError);
            }

            // Unlock photo for user - use upsert to avoid conflicts
            const { error: unlockError } = await supabase
              .from('unlocked_photos')
              .upsert(
                {
                  user_id: userId,
                  photo_id: item.photoId,
                  unlocked_at: new Date().toISOString(),
                },
                {
                  onConflict: 'user_id,photo_id',
                  ignoreDuplicates: true,
                }
              );

            if (unlockError) {
              console.error(`[${event.id}] Error unlocking photo:`, unlockError);
            } else {
              unlockedCount++;
              console.info(`[${event.id}] Unlocked photo: ${item.photoId}`);
            }
          }
        }

        console.info(`[${event.id}] Unlocked ${unlockedCount} photos`);

        // Clear user's cart items
        const { error: clearCartError } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId);

        if (clearCartError) {
          console.error(`[${event.id}] Error clearing cart:`, clearCartError);
        } else {
          console.info(`[${event.id}] Cleared cart for user`);
        }

        // Insert the order into the stripe_orders table (if it exists)
        await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'paid',
        }).then(() => {}).catch(() => {});

        console.info(`[${event.id}] Successfully processed cart purchase for session: ${checkout_session_id}`);
      } catch (error: any) {
        console.error(`[${event.id}] Error processing one-time payment:`, error.message, error);
        throw error;
      }
    }
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}