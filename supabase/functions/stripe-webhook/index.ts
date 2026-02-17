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

type CheckoutCartItem = {
  photoId?: string | null;
  quantity?: number;
  price?: number;
  type?: 'photo' | 'pass' | 'ticket' | string;
  selectedDate?: string | null;
  title?: string | null;
};

type PhotoForLeaderboard = {
  id: string;
  speed_kmh: number | null;
  captured_at: string;
  storage_path: string;
  park_id: string | null;
};

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
        const { data: userProfile } = await supabase
          .from('users')
          .select('park_id')
          .eq('id', userId)
          .maybeSingle();
        const userParkId = userProfile?.park_id ?? '11111111-1111-1111-1111-111111111111';
        console.info(`[${event.id}] Found user: ${userId}`);

        // Parse cart items from metadata
        const cartItems: CheckoutCartItem[] = metadata?.cart_items ? JSON.parse(metadata.cart_items) : [];
        console.info(`[${event.id}] Cart items: ${cartItems.length}`);

        if (cartItems.length === 0) {
          console.error(`[${event.id}] No cart items in metadata`);
          return;
        }

        const purchasedAtIso = new Date().toISOString();
        const representativePhotoId = await findRepresentativePhotoIdForPurchase(cartItems, purchasedAtIso, userParkId);

        // Create purchase record (photo_id may be null for pass-only orders)
        const { data: purchase, error: purchaseError } = await supabase
          .from('purchases')
          .insert({
            user_id: userId,
            photo_id: representativePhotoId,
            park_id: userParkId,
            stripe_checkout_session_id: checkout_session_id,
            stripe_payment_intent_id: payment_intent as string,
            amount_cents: amount_total,
            currency,
            paid_at: purchasedAtIso,
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
                unit_amount_cents: Math.round((item.price ?? 0) * 100),
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
                  park_id: userParkId,
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
              await upsertLeaderboardEntryForPhoto(userId, item.photoId, userParkId, event.id);
            }
            continue;
          }

          if (item.type === 'pass') {
            const dayRange = getDayRangeInUtc(item.selectedDate ?? null, purchasedAtIso);
            console.info(`[${event.id}] Processing pass for day: ${dayRange.selectedDate}`);

            // Record the pass purchase item
            const { error: passItemError } = await supabase
              .from('purchase_items')
              .insert({
                purchase_id: purchase.id,
                item_type: 'photopass',
                product_code: `tagesfotopass:${dayRange.selectedDate}`,
                unit_amount_cents: Math.round((item.price ?? 0) * 100),
                quantity: 1,
              });

            if (passItemError) {
              console.error(`[${event.id}] Error creating photopass purchase_item:`, passItemError);
            }

            // Unlock all photos captured on the pass day
            const { data: dayPhotos, error: dayPhotosError } = await supabase
              .from('photos')
              .select('id, speed_kmh, captured_at, storage_path, park_id')
              .eq('park_id', userParkId)
              .gte('captured_at', dayRange.startIso)
              .lt('captured_at', dayRange.endIso);

            if (dayPhotosError) {
              console.error(`[${event.id}] Error loading photos for pass day:`, dayPhotosError);
              continue;
            }

            const uniquePhotoIds = Array.from(new Set((dayPhotos || []).map((p: any) => p.id).filter(Boolean)));
            if (uniquePhotoIds.length === 0) {
              console.info(`[${event.id}] No photos found for pass day ${dayRange.selectedDate}`);
              continue;
            }

            const unlockRows = uniquePhotoIds.map((photoId) => ({
              user_id: userId,
              photo_id: photoId,
              park_id: userParkId,
              unlocked_at: purchasedAtIso,
            }));

            const { error: passUnlockError } = await supabase
              .from('unlocked_photos')
              .upsert(unlockRows, {
                onConflict: 'user_id,photo_id',
                ignoreDuplicates: true,
              });

            if (passUnlockError) {
              console.error(`[${event.id}] Error unlocking day-pass photos:`, passUnlockError);
            } else {
              unlockedCount += uniquePhotoIds.length;
              console.info(`[${event.id}] Unlocked ${uniquePhotoIds.length} photos for pass day`);

              const leaderboardRows = (dayPhotos || []).map((photo: PhotoForLeaderboard) => ({
                user_id: userId,
                photo_id: photo.id,
                speed_kmh: resolveSpeedForLeaderboard(photo.speed_kmh, photo.storage_path),
                ride_date: toDateOnly(photo.captured_at),
                park_id: photo.park_id ?? userParkId,
              }));

              if (leaderboardRows.length > 0) {
                const { error: leaderboardError } = await supabase
                  .from('leaderboard_entries')
                  .upsert(leaderboardRows, {
                    onConflict: 'user_id,photo_id',
                    ignoreDuplicates: false,
                  });

                if (leaderboardError) {
                  console.error(`[${event.id}] Error upserting pass leaderboard entries:`, leaderboardError);
                }
              }
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

function parseSpeedFromStoragePath(storagePath: string | null | undefined): number {
  if (!storagePath) return 0;

  const fileName = storagePath.split('/').pop() || storagePath;
  const fileStem = fileName.replace(/\.[^.]+$/, '');
  const explicitSuffix = fileStem.match(/_S(\d{4})$/i);
  if (!explicitSuffix?.[1]) return 0;

  const parsed = Number.parseInt(explicitSuffix[1], 10);
  if (Number.isNaN(parsed)) return 0;
  return parsed / 100;
}

function resolveSpeedForLeaderboard(speedFromDb: number | null | undefined, storagePath: string | null | undefined): number {
  if (typeof speedFromDb === 'number' && Number.isFinite(speedFromDb) && speedFromDb > 0) {
    return speedFromDb;
  }
  return parseSpeedFromStoragePath(storagePath);
}

function toDateOnly(isoOrDateString: string): string {
  return new Date(isoOrDateString).toISOString().slice(0, 10);
}

async function upsertLeaderboardEntryForPhoto(userId: string, photoId: string, userParkId: string, eventId: string) {
  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, speed_kmh, captured_at, storage_path, park_id')
    .eq('id', photoId)
    .maybeSingle();

  if (photoError || !photo) {
    console.error(`[${eventId}] Error loading photo for leaderboard:`, photoError || `missing photo ${photoId}`);
    return;
  }

  const { error: leaderboardError } = await supabase
    .from('leaderboard_entries')
    .upsert(
      {
        user_id: userId,
        photo_id: photo.id,
        speed_kmh: resolveSpeedForLeaderboard(photo.speed_kmh, photo.storage_path),
        ride_date: toDateOnly(photo.captured_at),
        park_id: photo.park_id ?? userParkId,
      },
      {
        onConflict: 'user_id,photo_id',
        ignoreDuplicates: false,
      },
    );

  if (leaderboardError) {
    console.error(`[${eventId}] Error upserting leaderboard entry:`, leaderboardError);
  }
}

function getDayRangeInUtc(selectedDate: string | null, fallbackIso: string) {
  const fallbackDate = new Date(fallbackIso);
  const day = selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
    ? selectedDate
    : fallbackDate.toISOString().slice(0, 10);

  const [year, month, date] = day.split('-').map((n) => parseInt(n, 10));
  const start = new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, date + 1, 0, 0, 0, 0));

  return {
    selectedDate: day,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

async function findRepresentativePhotoIdForPurchase(cartItems: CheckoutCartItem[], fallbackIso: string, parkId: string) {
  const photoItem = cartItems.find((item) => item.type === 'photo' && !!item.photoId);
  if (photoItem?.photoId) {
    return photoItem.photoId;
  }

  const passItem = cartItems.find((item) => item.type === 'pass');
  if (passItem) {
    const dayRange = getDayRangeInUtc(passItem.selectedDate ?? null, fallbackIso);
    const { data: passDayPhoto } = await supabase
      .from('photos')
      .select('id')
      .eq('park_id', parkId)
      .gte('captured_at', dayRange.startIso)
      .lt('captured_at', dayRange.endIso)
      .order('captured_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (passDayPhoto?.id) {
      return passDayPhoto.id;
    }
  }

  return null;
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
