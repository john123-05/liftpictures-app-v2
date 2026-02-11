import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart, Minus, Plus, Trash2, CreditCard, Lock } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '@/contexts/CartContext';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

export default function CartScreen() {
  const { t } = useTranslation();
  const { items, total, itemCount, updateQuantity, removeFromCart, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert(t('cart.emptyCart'), t('cart.emptyCartDescription'));
      return;
    }

    setIsProcessing(true);

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert(t('common.error'), t('cart.loginRequired'));
        setIsProcessing(false);
        return;
      }

      // Get Supabase URL from environment
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

      console.log('Starting checkout with URL:', supabaseUrl);

      // Call cart-checkout edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/cart-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: items,
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/cart`,
        }),
      });

      console.log('Response status:', response.status);

      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok || data.error) {
        console.error('Checkout error:', data.error);
        Alert.alert(t('common.error'), data.error || t('cart.checkoutStartFailed'));
        setIsProcessing(false);
        return;
      }

      // Open Stripe Checkout
      if (data.url) {
        console.log('Opening Stripe checkout URL:', data.url);

        if (Platform.OS === 'web') {
          // On web, open in same window
          window.location.href = data.url;
        } else {
          // On mobile, open in browser
          const result = await WebBrowser.openBrowserAsync(data.url);

          // When user returns from browser
          if (result.type === 'cancel' || result.type === 'dismiss') {
            Alert.alert(
              t('cart.paymentCancelledTitle'),
              t('cart.paymentCancelledDescription'),
              [{ text: t('common.ok') }]
            );
          } else {
            // Payment successful - clear cart and show success
            clearCart();
            Alert.alert(
              t('cart.paymentSuccessful'),
              t('cart.photosUnlocked'),
              [
                {
                  text: t('common.ok'),
                  onPress: () => router.push('/(tabs)/gallery'),
                },
              ]
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      console.error('Error details:', error.message, error.stack);
      Alert.alert(t('common.error'), t('cart.checkoutErrorWithMessage', { message: error.message || t('cart.unknownError') }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuantityChange = (photoId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      Alert.alert(
        t('cart.removePhoto'),
        t('cart.removePhotoDescription'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('cart.remove'), onPress: () => removeFromCart(photoId) },
        ]
      );
    } else {
      updateQuantity(photoId, newQuantity);
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" />

        <View style={styles.header}>
          <Text style={styles.title}>{t('cart.title')}</Text>
          <Text style={styles.subtitle}>{t('cart.yourSelectedPhotos')}</Text>
        </View>

        <View style={styles.emptyContainer}>
          <ShoppingCart size={80} color="#333" />
          <Text style={styles.emptyTitle}>{t('cart.empty')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('cart.emptyDescription')}
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/gallery')}
          >
            <Text style={styles.browseButtonText}>{t('cart.browseGallery')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />

      <View style={styles.header}>
        <Text style={styles.title}>{t('cart.title')}</Text>
        <Text style={styles.subtitle}>
          {t('cart.subtitle', {
            count: itemCount,
            unit: itemCount === 1 ? t('cart.photo') : t('cart.photos'),
            total: total.toFixed(2)
          })}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.itemsList}>
          {items.map((item) => (
            <View key={item.id} style={styles.cartItem}>
              {item.type === 'pass' ? (
                <View style={styles.passIcon}>
                  <Text style={styles.passIconText}>🌟</Text>
                </View>
              ) : item.type === 'ticket' ? (
                <View style={styles.ticketIcon}>
                  <Text style={styles.ticketIconText}>🎢</Text>
                </View>
              ) : (
                <Image source={{ uri: item.url }} style={styles.itemImage} />
              )}
              
              <View style={styles.itemInfo}>
                <Text style={styles.itemTime}>
                  {item.type === 'pass' ? (item.title || t('home.dayPhotoPass')) : item.timestamp}
                </Text>
                {item.type !== 'pass' && (
                  <Text style={styles.itemSpeed}>{t('gallery.speed', { speed: item.speed })}</Text>
                )}
                {(item.type === 'pass' || item.type === 'ticket') && (
                  <Text style={styles.itemDescription}>{t('cart.unlimitedPhotosToday')}</Text>
                )}
                {item.type === 'ticket' && (
                  <>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                    {item.selectedDate && (
                      <Text style={styles.itemDate}>
                        📅 {new Date(item.selectedDate).toLocaleDateString('de-DE', { 
                          weekday: 'short', 
                          day: '2-digit', 
                          month: '2-digit',
                          year: 'numeric' 
                        })}
                      </Text>
                    )}
                  </>
                )}
                <Text style={styles.itemPrice}>€{item.price.toFixed(2)}</Text>
              </View>

              <View style={styles.itemControls}>
                {item.type === 'photo' ? (
                  <View style={styles.quantitySingleContainer}>
                    <Text style={styles.quantitySingleText}>1</Text>
                  </View>
                ) : (
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(item.photoId, item.quantity - 1)}
                    >
                      <Minus size={16} color="#fff" />
                    </TouchableOpacity>
                    
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(item.photoId, item.quantity + 1)}
                    >
                      <Plus size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeFromCart(item.photoId)}
                >
                  <Trash2 size={16} color="#ff4757" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('cart.orderSummary')}</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('cart.subtotal')}</Text>
            <Text style={styles.summaryValue}>€{total.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('cart.processingFee')}</Text>
            <Text style={styles.summaryValue}>€0.00</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>{t('cart.total')}</Text>
            <Text style={styles.summaryTotalValue}>€{total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>{t('cart.paymentMethod')}</Text>

          <View style={styles.paymentMethod}>
            <CreditCard size={24} color="#ff6b35" />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethodText}>Stripe Checkout</Text>
              <Text style={styles.paymentMethodSubtext}>Kreditkarte, Apple Pay, Google Pay</Text>
            </View>
            <Lock size={16} color="#00c851" />
          </View>
        </View>

        <View style={styles.securityNote}>
          <Lock size={16} color="#00c851" />
          <Text style={styles.securityText}>
            Sichere Zahlung mit Stripe • SSL-verschlüsselt
          </Text>
        </View>
      </ScrollView>

      <View style={styles.checkoutContainer}>
        <TouchableOpacity
          style={[styles.checkoutButton, isProcessing && styles.checkoutButtonProcessing]}
          onPress={handleCheckout}
          disabled={isProcessing}
        >
          <LinearGradient
            colors={isProcessing ? ['#cc5429', '#cc5429'] : ['#ff6b35', '#ff8c42']}
            style={styles.checkoutGradient}
          >
            <Text style={styles.checkoutButtonText}>
              {isProcessing ? t('cart.processing') : t('cart.buyNow', { total: total.toFixed(2) })}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearCartButton}
          onPress={() => {
            Alert.alert(
              t('cart.clearCartButton'),
              t('cart.clearCartConfirm'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('cart.clearCartButton'), onPress: clearCart },
              ]
            );
          }}
        >
          <Text style={styles.clearCartButtonText}>{t('cart.clearCart')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  browseButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  itemsList: {
    marginBottom: 24,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemSpeed: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  passIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passIconText: {
    fontSize: 32,
  },
  ticketIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketIconText: {
    fontSize: 32,
  },
  itemDescription: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: '#ff6b35',
    marginBottom: 4,
    fontWeight: '600',
  },
  itemControls: {
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  quantityButton: {
    padding: 8,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    paddingHorizontal: 12,
  },
  quantitySingleContainer: {
    minHeight: 32,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantitySingleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  removeButton: {
    padding: 8,
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#999',
  },
  summaryValue: {
    fontSize: 16,
    color: '#fff',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  paymentMethodSubtext: {
    fontSize: 14,
    color: '#999',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  securityText: {
    fontSize: 14,
    color: '#00c851',
    marginLeft: 8,
  },
  checkoutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  checkoutButton: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  checkoutButtonProcessing: {
    opacity: 0.7,
  },
  checkoutGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  clearCartButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clearCartButtonText: {
    fontSize: 16,
    color: '#666',
  },
});
