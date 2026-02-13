import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SuccessScreen() {
  const router = useRouter();
  const { clearCart } = useCart();
  const { session_id } = useLocalSearchParams<{ session_id?: string | string[] }>();
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false);
  const [purchaseLinked, setPurchaseLinked] = useState(false);

  const checkoutSessionId = useMemo(
    () => (Array.isArray(session_id) ? session_id[0] : session_id) || null,
    [session_id]
  );

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    if (!checkoutSessionId) return;

    let cancelled = false;
    setIsCheckingPurchase(true);

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const verifyPurchaseLink = async () => {
      for (let i = 0; i < 12; i++) {
        const { data, error } = await supabase
          .from('purchases')
          .select('id')
          .eq('stripe_checkout_session_id', checkoutSessionId)
          .maybeSingle();

        if (cancelled) return;

        if (data?.id) {
          setPurchaseLinked(true);
          setIsCheckingPurchase(false);
          return;
        }

        if (error) {
          console.warn('Could not verify purchase link yet:', error.message);
        }

        await wait(1500);
      }

      if (!cancelled) {
        setIsCheckingPurchase(false);
      }
    };

    void verifyPurchaseLink();

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <CheckCircle size={80} color="#10b981" />
        <Text style={styles.title}>Zahlung erfolgreich!</Text>
        {isCheckingPurchase ? (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color="#6b7280" />
            <Text style={styles.processingText}>Freischaltung wird geprüft...</Text>
          </View>
        ) : null}
        <Text style={styles.message}>
          {purchaseLinked || !checkoutSessionId
            ? 'Ihre Fotos wurden freigeschaltet und sind jetzt in Ihrer Galerie verfügbar.'
            : 'Die Zahlung ist durch. Die Freischaltung kann ein paar Sekunden dauern.'}
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(tabs)/gallery')}
        >
          <Text style={styles.buttonText}>Zur Galerie</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(tabs)/dashboard')}
        >
          <Text style={styles.secondaryButtonText}>Zurück zum Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 400,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  processingText: {
    color: '#6b7280',
    fontSize: 14,
    marginLeft: 8,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
