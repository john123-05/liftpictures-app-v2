import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Heart, ShoppingCart, Download } from 'lucide-react-native';

interface PhotoCardProps {
  photo: {
    id: string;
    url: string;
    timestamp: string;
    speed: number;
    price: number;
    isFavorite: boolean;
    isPurchased?: boolean;
  };
  onToggleFavorite: (id: string) => void;
  onBuyPhoto: (id: string) => void;
  viewMode?: 'grid' | 'list';
}

export default function PhotoCard({ 
  photo, 
  onToggleFavorite, 
  onBuyPhoto, 
  viewMode = 'grid' 
}: PhotoCardProps) {
  if (viewMode === 'list') {
    return (
      <View style={styles.listCard}>
        <Image source={{ uri: photo.url }} style={styles.listImage} />
        <View style={styles.listInfo}>
          <Text style={styles.listTime}>{photo.timestamp}</Text>
          <Text style={styles.listSpeed}>{photo.speed} km/h</Text>
          <Text style={styles.listPrice}>€{photo.price.toFixed(2)}</Text>
        </View>
        <View style={styles.listActions}>
          <TouchableOpacity
            style={[styles.actionButton, photo.isFavorite && styles.favoriteActive]}
            onPress={() => onToggleFavorite(photo.id)}
          >
            <Heart 
              size={20} 
              color={photo.isFavorite ? '#fff' : '#ff6b35'} 
              fill={photo.isFavorite ? '#ff6b35' : 'none'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.buyButton]}
            onPress={() => onBuyPhoto(photo.id)}
          >
            {photo.isPurchased ? (
              <Download size={20} color="#000" />
            ) : (
              <ShoppingCart size={20} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.gridCard}>
      <Image source={{ uri: photo.url }} style={styles.gridImage} />
      <TouchableOpacity
        style={[styles.favoriteButton, photo.isFavorite && styles.favoriteActive]}
        onPress={() => onToggleFavorite(photo.id)}
      >
        <Heart 
          size={16} 
          color={photo.isFavorite ? '#fff' : '#ff6b35'} 
          fill={photo.isFavorite ? '#ff6b35' : 'none'}
        />
      </TouchableOpacity>
      <View style={styles.gridInfo}>
        <Text style={styles.gridTime}>{photo.timestamp}</Text>
        <Text style={styles.gridSpeed}>{photo.speed} km/h</Text>
      </View>
      <TouchableOpacity
        style={[styles.buyButton, photo.isPurchased && styles.downloadButton]}
        onPress={() => onBuyPhoto(photo.id)}
      >
        {photo.isPurchased ? (
          <Download size={16} color="#000" />
        ) : (
          <ShoppingCart size={16} color="#000" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteActive: {
    backgroundColor: '#ff6b35',
  },
  gridInfo: {
    padding: 12,
  },
  gridTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  gridSpeed: {
    fontSize: 12,
    color: '#999',
  },
  buyButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#ff6b35',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#00c851',
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    alignItems: 'center',
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  listSpeed: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  listPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b35',
  },
  listActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});