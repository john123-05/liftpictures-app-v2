import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCart } from '@/contexts/CartContext';

interface CartBadgeProps {
  color?: string;
}

export default function CartBadge({ color = '#ff6b35' }: CartBadgeProps) {
  const { itemCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>
        {itemCount > 99 ? '99+' : itemCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
});